import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const db = new PrismaClient();
const storageRoot = () => process.env.STORAGE_DIR ?? './storage';

function chunks(text: string, size = 1800, overlap = 200) {
  const out: string[] = [];
  for (let start = 0; start < text.length; start += Math.max(1, size - overlap)) {
    out.push(text.slice(start, start + size));
    if (start + size >= text.length) break;
  }
  return out.filter(Boolean);
}

async function processDocument(documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId }, select: { id:true, mimeType:true, storageKey:true, status:true } });
  if (!document) throw new Error('Document not found');
  if (document.status === 'DELETED') return;
  await db.document.update({ where:{id:document.id}, data:{status:'PROCESSING'} });
  try {
    const file = await readFile(path.resolve(storageRoot(), document.storageKey));
    if (document.mimeType === 'text/plain' || document.mimeType === 'text/csv') {
      const text = file.toString('utf8');
      const parts = chunks(text);
      await db.$transaction(async tx => {
        await tx.documentChunk.deleteMany({ where:{documentId:document.id} });
        for (let i=0;i<parts.length;i++) {
          await tx.documentChunk.create({data:{documentId:document.id,chunkIndex:i,content:parts[i],metadata:{source:'text-extraction'}}});
        }
        await tx.document.update({where:{id:document.id},data:{status:'PROCESSED'}});
      });
      return;
    }
    await db.document.update({where:{id:document.id},data:{status:'NEEDS_EXTRACTION'}});
  } catch (error) {
    await db.document.update({where:{id:document.id},data:{status:'FAILED'}});
    throw error;
  }
}

const worker = new Worker('document-processing', async job => {
  if (!job.data?.documentId) throw new Error('documentId is required');
  await processDocument(String(job.data.documentId));
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) });

worker.on('completed', job => console.log(`Completed document job ${job.id}`));
worker.on('failed', (job, error) => console.error(`Failed document job ${job?.id}`, error));

const shutdown = async (signal: string) => {
  console.log(`LIFEOS document worker stopping (${signal})`);
  await worker.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

console.log('LIFEOS document worker started');
