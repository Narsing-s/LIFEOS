import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import prismaPlugin from './plugins/prisma.js';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.js';
import { lifeRoutes } from './routes/life.js';
import { assistantRoutes } from './routes/assistant.js';

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(helmet);
await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(prismaPlugin);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = (error as any).statusCode ?? (error.name === 'ZodError' ? 400 : 500);
  const message = status >= 500 ? 'Internal server error' : error.message;
  reply.code(status).send({ error: message });
});

app.get('/health', async () => ({ ok:true, service:'lifeos-api', version:'0.2.0' }));
app.get('/api/v1', async () => ({ name:'LIFEOS API', version:'v1', capabilities:['auth','dashboard','search','memories','tasks','assets','assistant'] }));
await app.register(authRoutes, { prefix:'/api/v1/auth' });
await app.register(lifeRoutes, { prefix:'/api/v1' });
await app.register(assistantRoutes, { prefix:'/api/v1/assistant' });

await app.listen({ port:env.PORT, host:'0.0.0.0' });
