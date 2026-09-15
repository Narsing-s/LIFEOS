import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthUser = { id: string; email: string };

declare module 'fastify' {
  interface FastifyRequest { user: AuthUser }
}

export async function requireAuth(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }
  try {
    request.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 });
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' });
}
