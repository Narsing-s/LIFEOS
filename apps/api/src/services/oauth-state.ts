import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

export function createOAuthState(userId: string) {
  const nonce = randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(nonce).digest('hex');
  return { nonce, digest, userId };
}

export async function consumeOAuthState(app: { prisma: { $queryRaw: Function; $executeRaw: Function } }, userId: string, digest: string) {
  const rows = await app.prisma.$queryRaw(Prisma.sql`DELETE FROM oauth_states WHERE user_id=${userId} AND state_hash=${digest} AND expires_at > now() RETURNING user_id`);
  return Array.isArray(rows) && rows.length > 0;
}
