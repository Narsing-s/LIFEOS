import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const worker = new Worker('document-processing', async job => {
  // Pipeline boundary: download -> extract/OCR -> classify -> chunk -> embed -> persist.
  console.log(`Processing document ${job.data.documentId}`);
}, { connection });

worker.on('completed', job => console.log(`Completed ${job.id}`));
worker.on('failed', (job, error) => console.error(`Failed ${job?.id}`, error));

console.log('LIFEOS document worker started');
