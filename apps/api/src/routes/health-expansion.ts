import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

export async function healthExpansionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/sync/runs', async r => app.prisma.$queryRaw(Prisma.sql`SELECT id, connection_id AS "connectionId", status, started_at AS "startedAt", finished_at AS "completedAt", imported_count AS "recordsImported", skipped_count AS "skippedCount", error_count AS "errorCount", error AS "errorMessage" FROM sync_runs WHERE user_id=${r.user.id} ORDER BY created_at DESC LIMIT 25`));
  app.get('/life/overview', async r => {
    const [timeline,inbox,connections,syncs,automations]=await Promise.all([
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM timeline_events WHERE user_id=${r.user.id} ORDER BY occurred_at DESC LIMIT 8`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,source_provider,source_id,kind,title AS subject,COALESCE(metadata->>'from',NULL) AS sender,received_at,action_status,classification,metadata FROM inbox_items WHERE user_id=${r.user.id} ORDER BY received_at DESC LIMIT 8`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,provider,status,account_email AS "accountEmail",last_synced_at AS "lastSyncedAt" FROM integration_connections WHERE user_id=${r.user.id} ORDER BY created_at DESC`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,connection_id AS "connectionId",status,started_at AS "startedAt",finished_at AS "completedAt",imported_count AS "recordsImported",skipped_count AS "skippedCount",error_count AS "errorCount",error AS "errorMessage" FROM sync_runs WHERE user_id=${r.user.id} ORDER BY created_at DESC LIMIT 5`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,name,enabled,trigger_type AS "triggerType",conditions,actions,last_run_at AS "lastRunAt",run_count AS "runCount" FROM automation_rules WHERE user_id=${r.user.id} ORDER BY created_at DESC LIMIT 50`)
    ]);
    return {timeline,inbox,connections,syncs,automations};
  });
}
