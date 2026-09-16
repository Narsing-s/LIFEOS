import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { decryptSecret } from '../services/crypto.js';
import { googleAuthorizationUrl, exchangeGoogleCode } from '../integrations/google.js';

const json = (v: unknown) => JSON.stringify(v ?? {});
const idParam = z.object({ id: z.string().uuid() });

export async function expansionRoutes(app: FastifyInstance) {
  app.get('/integrations/google/callback', async (r, reply) => {
    const q = z.object({ code:z.string().min(1), state:z.string().min(1) }).parse(r.query);
    let state: {userId:string};
    try { state = jwt.verify(q.state, env.JWT_SECRET) as {userId:string}; } catch { return reply.code(400).send({error:'Invalid or expired OAuth state'}); }
    const token = await exchangeGoogleCode(q.code);
    await app.prisma.$executeRaw(Prisma.sql`INSERT INTO integration_connections (user_id, provider, account_id, status, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes) VALUES (${state.userId}, 'GOOGLE', 'default', 'CONNECTED', ${token.accessTokenEncrypted}, ${token.refreshTokenEncrypted ?? null}, ${token.expiresAt ?? null}, ${JSON.stringify(token.scopes)}::jsonb) ON CONFLICT (user_id, provider, account_id) DO UPDATE SET access_token_encrypted=EXCLUDED.access_token_encrypted, refresh_token_encrypted=COALESCE(EXCLUDED.refresh_token_encrypted,integration_connections.refresh_token_encrypted), token_expires_at=EXCLUDED.token_expires_at, scopes=EXCLUDED.scopes, status='CONNECTED', updated_at=now()`);
    return { ok:true, provider:'GOOGLE', message:'Google connected. Run sync to import permitted data.' };
  });

  app.addHook('preHandler', requireAuth);
  app.get('/integrations', async r => app.prisma.$queryRaw(Prisma.sql`SELECT id, provider, account_id AS "accountId", account_email AS "accountEmail", status, scopes, last_synced_at AS "lastSyncedAt", created_at AS "createdAt" FROM integration_connections WHERE user_id=${r.user.id} ORDER BY created_at DESC`));
  app.get('/integrations/google/connect', async r => ({ authorizationUrl: googleAuthorizationUrl(jwt.sign({userId:r.user.id,nonce:crypto.randomUUID()},env.JWT_SECRET,{expiresIn:'10m'})) }));

  app.delete('/integrations/:id', async (r, reply) => {
    const {id}=idParam.parse(r.params);
    const rows=await app.prisma.$queryRaw<{provider:string;access_token_encrypted:string|null}[]>(Prisma.sql`SELECT provider,access_token_encrypted FROM integration_connections WHERE id=${id} AND user_id=${r.user.id} LIMIT 1`);
    if(!rows[0]) return reply.code(404).send({error:'Integration not found'});
    if(rows[0].provider==='GOOGLE' && rows[0].access_token_encrypted) {
      try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptSecret(rows[0].access_token_encrypted))}`,{method:'POST'}); } catch { /* local deletion still guarantees provider data is no longer usable by LIFEOS */ }
    }
    await app.prisma.$executeRaw(Prisma.sql`DELETE FROM integration_connections WHERE id=${id} AND user_id=${r.user.id}`);
    return {ok:true};
  });

  app.get('/timeline', async r => { const q=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional(),limit:z.coerce.number().int().min(1).max(200).default(100)}).parse(r.query); return app.prisma.$queryRaw(Prisma.sql`SELECT * FROM timeline_events WHERE user_id=${r.user.id} AND (${q.from ? Prisma.sql`occurred_at >= ${new Date(q.from)}` : Prisma.sql`true`}) AND (${q.to ? Prisma.sql`occurred_at <= ${new Date(q.to)}` : Prisma.sql`true`}) ORDER BY occurred_at DESC LIMIT ${q.limit}`); });
  app.post('/timeline', async r => { const b=z.object({eventType:z.string().max(60),title:z.string().min(1).max(500),description:z.string().optional(),occurredAt:z.string().datetime(),endAt:z.string().datetime().optional(),sourceProvider:z.string().max(40).optional(),sourceId:z.string().max(255).optional(),location:z.any().optional(),people:z.array(z.any()).default([]),linkedRecords:z.array(z.any()).default([]),metadata:z.any().default({})}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO timeline_events (user_id,event_type,title,description,occurred_at,end_at,source_provider,source_id,location,people,linked_records,metadata) VALUES (${r.user.id},${b.eventType},${b.title},${b.description??null},${new Date(b.occurredAt)},${b.endAt?new Date(b.endAt):null},${b.sourceProvider??null},${b.sourceId??null},${json(b.location)}::jsonb,${json(b.people)}::jsonb,${json(b.linkedRecords)}::jsonb,${json(b.metadata)}::jsonb) RETURNING *`); });
  app.get('/inbox', async r => app.prisma.$queryRaw(Prisma.sql`SELECT * FROM inbox_items WHERE user_id=${r.user.id} ORDER BY received_at DESC LIMIT 100`));
  app.patch('/inbox/:id', async r => { const {id}=idParam.parse(r.params); const b=z.object({classification:z.string().max(50).optional(),actionStatus:z.string().max(30).optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`UPDATE inbox_items SET classification=COALESCE(${b.classification??null},classification), action_status=COALESCE(${b.actionStatus??null},action_status) WHERE id=${id} AND user_id=${r.user.id} RETURNING *`); });
  app.get('/finance/summary', async r => { const [expense,subs,budgets,goals]=await Promise.all([app.prisma.expense.aggregate({where:{userId:r.user.id},_sum:{amount:true},_count:true}),app.prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total FROM finance_subscriptions WHERE user_id=${r.user.id} AND status='ACTIVE'`),app.prisma.$queryRaw(Prisma.sql`SELECT * FROM finance_budgets WHERE user_id=${r.user.id} ORDER BY starts_on DESC`),app.prisma.$queryRaw(Prisma.sql`SELECT * FROM finance_goals WHERE user_id=${r.user.id} ORDER BY created_at DESC`)]); return {expense,subscriptions:subs,budgets,goals}; });
  app.post('/finance/subscriptions', async r => { const b=z.object({merchant:z.string().min(1),amount:z.number().positive(),currency:z.string().length(3).default('INR'),cadence:z.string().max(30),nextChargeAt:z.string().datetime().optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO finance_subscriptions(user_id,merchant,amount,currency,cadence,next_charge_at) VALUES(${r.user.id},${b.merchant},${b.amount},${b.currency},${b.cadence},${b.nextChargeAt?new Date(b.nextChargeAt):null}) RETURNING *`); });
  app.post('/finance/budgets', async r => { const b=z.object({name:z.string().min(1),category:z.string().optional(),amount:z.number().positive(),currency:z.string().length(3).default('INR'),period:z.string().default('MONTHLY'),startsOn:z.string().date(),endsOn:z.string().date().optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO finance_budgets(user_id,name,category,amount,currency,period,starts_on,ends_on) VALUES(${r.user.id},${b.name},${b.category??null},${b.amount},${b.currency},${b.period},${b.startsOn},${b.endsOn??null}) RETURNING *`); });
  app.post('/finance/goals', async r => { const b=z.object({name:z.string().min(1),targetAmount:z.number().positive(),currentAmount:z.number().nonnegative().default(0),currency:z.string().length(3).default('INR'),targetDate:z.string().date().optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO finance_goals(user_id,name,target_amount,current_amount,currency,target_date) VALUES(${r.user.id},${b.name},${b.targetAmount},${b.currentAmount},${b.currency},${b.targetDate??null}) RETURNING *`); });
  app.get('/notifications', async r => app.prisma.$queryRaw(Prisma.sql`SELECT * FROM notification_deliveries WHERE user_id=${r.user.id} ORDER BY scheduled_at DESC LIMIT 100`));
  app.post('/notifications', async r => { const b=z.object({channel:z.string().max(30).default('IN_APP'),type:z.string().max(60),title:z.string().max(255),body:z.string().min(1),scheduledAt:z.string().datetime().optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO notification_deliveries(user_id,channel,type,title,body,scheduled_at) VALUES(${r.user.id},${b.channel},${b.type},${b.title},${b.body},${b.scheduledAt?new Date(b.scheduledAt):new Date()}) RETURNING *`); });
  app.get('/automations', async r => app.prisma.$queryRaw(Prisma.sql`SELECT * FROM automation_rules WHERE user_id=${r.user.id} ORDER BY created_at DESC`));
  app.post('/automations', async r => { const b=z.object({name:z.string().min(1).max(160),triggerType:z.string().max(60),conditions:z.array(z.any()).default([]),actions:z.array(z.any()).default([]),enabled:z.boolean().default(true)}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`INSERT INTO automation_rules(user_id,name,trigger_type,conditions,actions,enabled) VALUES(${r.user.id},${b.name},${b.triggerType},${json(b.conditions)}::jsonb,${json(b.actions)}::jsonb,${b.enabled}) RETURNING *`); });
  app.patch('/automations/:id', async r => { const {id}=idParam.parse(r.params); const b=z.object({enabled:z.boolean().optional(),name:z.string().max(160).optional()}).parse(r.body); return app.prisma.$queryRaw(Prisma.sql`UPDATE automation_rules SET enabled=COALESCE(${b.enabled??null},enabled),name=COALESCE(${b.name??null},name),updated_at=now() WHERE id=${id} AND user_id=${r.user.id} RETURNING *`); });
  app.get('/sync/history', async r => app.prisma.$queryRaw(Prisma.sql`SELECT id,connection_id AS "connectionId",status,started_at AS "startedAt",finished_at AS "finishedAt",imported_count AS "importedCount",skipped_count AS "skippedCount",error_count AS "errorCount",error FROM sync_runs WHERE user_id=${r.user.id} ORDER BY started_at DESC LIMIT 50`));
  app.post('/sync/:provider', async r => { const provider=z.string().min(1).max(40).parse((r.params as {provider:string}).provider.toUpperCase()); const rows=await app.prisma.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM integration_connections WHERE user_id=${r.user.id} AND provider=${provider} AND status='CONNECTED' LIMIT 1`); if(!rows[0]) return {ok:false,status:'NOT_CONNECTED',provider}; const active=await app.prisma.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM sync_runs WHERE connection_id=${rows[0].id} AND status IN ('QUEUED','RUNNING') LIMIT 1`); if(active[0]) return {ok:true,provider,status:'ALREADY_RUNNING',runId:active[0].id}; const run=await app.prisma.$queryRaw(Prisma.sql`INSERT INTO sync_runs(user_id,connection_id,status) VALUES(${r.user.id},${rows[0].id},'QUEUED') RETURNING id,status,started_at`); return {ok:true,provider,status:'QUEUED',run}; });
}
