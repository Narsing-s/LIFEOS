import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

const app = Fastify({ logger: true });

await app.register(helmet);
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

app.get('/health', async () => ({
  ok: true,
  service: 'lifeos-api',
  version: '0.1.0'
}));

app.get('/api/v1', async () => ({
  name: 'LIFEOS API',
  version: 'v1'
}));

const port = Number(process.env.PORT ?? 4000);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
