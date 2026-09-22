import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { decryptSecret } from '../services/crypto.js';
import { requireAuth } from '../middleware/auth.js';

const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));

async function revokeGoogleToken(token: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    // Account deletion must not be blocked by an unavailable provider revoke endpoint.
  }
}

export async function accountRoutes(app: FastifyInstance) {
  app.post('/account/password', { preHandler: requireAuth, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body=(request.body ?? {}) as {currentPassword?:string;newPassword?:string};
    if(typeof body.currentPassword!=='string' || typeof body.newPassword!=='string' || body.newPassword.length<8 || body.newPassword.length>128){
      return reply.code(400).send({error:'Current password and a new password between 8 and 128 characters are required'});
    }
    const user=await app.prisma.user.findUnique({where:{id:request.user.id},select:{passwordHash:true}});
    if(!user || !(await bcrypt.compare(body.currentPassword,user.passwordHash))) return reply.code(401).send({error:'Current password is incorrect'});
    if(body.currentPassword===body.newPassword) return reply.code(400).send({error:'New password must be different from the current password'});
    await app.prisma.user.update({where:{id:request.user.id},data:{passwordHash:await bcrypt.hash(body.newPassword,12)}});
    await app.prisma.auditLog.create({data:{userId:request.user.id,actorType:'USER',action:'PASSWORD_CHANGED',resourceType:'ACCOUNT',metadata:{}}});
    return {ok:true,message:'Password changed. Sign in again on other devices.'};
  });

  app.get('/account/export', { preHandler: requireAuth }, async request => {
    const uid = request.user.id;
    const [user, preferences, tasks, memories, assets, documents, expenses, trips, conversations, entities, timeline, inbox, integrations, financeSubscriptions, budgets, goals, notifications, automations, syncRuns] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: uid }, select: { id:true,email:true,displayName:true,avatarUrl:true,timezone:true,locale:true,createdAt:true,updatedAt:true } }),
      app.prisma.userPreference.findUnique({ where: { userId: uid } }),
      app.prisma.task.findMany({ where: { userId: uid } }),
      app.prisma.memory.findMany({ where: { userId: uid } }),
      app.prisma.asset.findMany({ where: { userId: uid }, include: { warranties:true } }),
      app.prisma.document.findMany({ where: { userId: uid }, select: { id:true,title:true,documentType:true,mimeType:true,fileSize:true,status:true,source:true,createdAt:true,updatedAt:true,deletedAt:true } }),
      app.prisma.expense.findMany({ where: { userId: uid } }),
      app.prisma.trip.findMany({ where: { userId: uid }, include: { items:true } }),
      app.prisma.conversation.findMany({ where: { userId: uid }, include: { messages:true } }),
      app.prisma.entity.findMany({ where: { userId: uid }, include: { fromLinks:true, toLinks:true } }),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM timeline_events WHERE user_id=${uid} ORDER BY occurred_at DESC`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM inbox_items WHERE user_id=${uid} ORDER BY received_at DESC`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,provider,account_id AS "accountId",account_email AS "accountEmail",status,scopes,last_synced_at AS "lastSyncedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM integration_connections WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM finance_subscriptions WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM finance_budgets WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM finance_goals WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM notification_deliveries WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM automation_rules WHERE user_id=${uid}`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM sync_runs WHERE user_id=${uid} ORDER BY started_at DESC`),
    ]);
    return jsonSafe({ exportedAt:new Date().toISOString(), version:'1.9', user, preferences, tasks, memories, assets, documents, expenses, trips, conversations, entities, timeline, inbox, integrations, financeSubscriptions, budgets, goals, notifications, automations, syncRuns });
  });

  app.delete('/account', { preHandler: requireAuth, config: { rateLimit: { max: 2, timeWindow: '1 hour' } } }, async (request, reply) => {
    const uid = request.user.id;
    const body = (request.body ?? {}) as { confirmation?: string };
    if (body.confirmation !== 'DELETE MY ACCOUNT') {
      return reply.code(400).send({ error: 'Type DELETE MY ACCOUNT to confirm permanent account deletion' });
    }

    const connections = await app.prisma.$queryRaw<Array<{ access_token_encrypted: string | null; refresh_token_encrypted: string | null }>>(Prisma.sql`
      SELECT access_token_encrypted, refresh_token_encrypted FROM integration_connections WHERE user_id=${uid}
    `);
    for (const connection of connections) {
      const encrypted = connection.refresh_token_encrypted ?? connection.access_token_encrypted;
      if (encrypted) {
        try { await revokeGoogleToken(decryptSecret(encrypted)); } catch { /* best effort */ }
      }
    }

    // Database relations use ON DELETE CASCADE for the user's LIFEOS records.
    // File bytes live outside PostgreSQL, so remove the per-user storage tree too.
    const storageDir = process.env.STORAGE_DIR ?? './storage';
    const userStorageDir = path.join(storageDir, uid);
    await app.prisma.auditLog.create({data:{userId:uid,actorType:'USER',action:'ACCOUNT_DELETION_REQUESTED',resourceType:'ACCOUNT',metadata:{}}});
    await app.prisma.user.delete({ where: { id: uid } });
    try {
      await rm(userStorageDir, { recursive: true, force: true });
    } catch (error) {
      request.log.error({ error, userId: uid }, 'Account deleted but user storage cleanup failed');
    }

    return reply.code(204).send();
  });
}
