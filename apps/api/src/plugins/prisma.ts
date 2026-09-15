import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default fp(async (app) => {
  await prisma.$connect();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => prisma.$disconnect());
});

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient }
}
