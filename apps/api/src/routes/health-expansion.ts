import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

export async function healthExpansionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/sync/runs', async r => app.prisma.$queryRaw(Prisma.sql`SELECT id, status, started_at AS "startedAt", completed_at AS "completedAt", records_imported AS "recordsImported", error_message AS "errorMessage" FROM sync_runs WHERE user_id=${r.user.id} ORDER BY created_at DESC LIMIT 25`));
  app.get('/life/overview', async r => {
    const [timeline,inbox,connections,syncs]=await Promise.all([
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM timeline_events WHERE user_id=${r.user.id} ORDER BY occurred_at DESC LIMIT 8`),
      app.prisma.$queryRaw(Prisma.sql`SELECT * FROM inbox_items WHERE user_id=${r.user.id} ORDER BY received_at DESC LIMIT 8`),
      app.prisma.$queryRaw(Prisma.sql`SELECT provider,status,last_synced_at AS "lastSyncedAt" FROM integration_connections WHERE user_id=${r.user.id} ORDER BY created_at DESC`),
      app.prisma.$queryRaw(Prisma.sql`SELECT id,status,started_at AS "startedAt",completed_at AS "completedAt",records_imported AS "recordsImported",error_message AS "errorMessage" FROM sync_runs WHERE user_id=${r.user.id} ORDER BY created_at DESC LIMIT 5`)
    ]);
    return {timeline,inbox,connections,syncs};
  });
}
