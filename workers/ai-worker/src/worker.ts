import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const worker = new Worker('ai-processing', async job => {
  console.log(`Processing AI job ${job.id}`, job.name);
}, { connection });
worker.on('completed', job => console.log(`Completed AI job ${job.id}`));
worker.on('failed', (job, error) => console.error(`Failed AI job ${job?.id}`, error));
console.log('LIFEOS AI worker started');
