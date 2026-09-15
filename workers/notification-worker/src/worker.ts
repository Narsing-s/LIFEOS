import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const worker = new Worker('notifications', async job => {
  console.log(`Delivering notification ${job.id}`, job.data);
}, { connection });
worker.on('completed', job => console.log(`Completed notification ${job.id}`));
worker.on('failed', (job, error) => console.error(`Failed notification ${job?.id}`, error));
console.log('LIFEOS notification worker started');
