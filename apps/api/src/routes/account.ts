import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

export async function accountRoutes(app: FastifyInstance) {
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
    return { exportedAt:new Date().toISOString(), version:'1.8', user, preferences, tasks, memories, assets, documents, expenses, trips, conversations, entities, timeline, inbox, integrations, financeSubscriptions, budgets, goals, notifications, automations, syncRuns };
  });
}
