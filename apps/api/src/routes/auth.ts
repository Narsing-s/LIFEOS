import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signToken, requireAuth } from '../middleware/auth.js';

const credentials = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = credentials.parse(request.body);
    const existing = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: 'An account with this email already exists' });
    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        displayName: body.displayName,
        preferences: { create: {} },
      },
      select: { id: true, email: true, displayName: true },
    });
    return reply.code(201).send({ user, token: signToken({ id: user.id, email: user.email }) });
  });

  app.post('/login', async (request, reply) => {
    const body = credentials.pick({ email: true, password: true }).parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    return { user: { id: user.id, email: user.email, displayName: user.displayName }, token: signToken({ id: user.id, email: user.email }) };
  });

  app.get('/me', { preHandler: requireAuth }, async request => {
    return app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, displayName: true, avatarUrl: true, timezone: true, locale: true },
    });
  });
}
