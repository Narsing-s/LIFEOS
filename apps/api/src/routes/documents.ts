import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.js';

const allowed = new Set(['application/pdf','image/png','image/jpeg','text/plain','text/csv']);

export async function documentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => {
    const file = await request.file({ limits:{fileSize:25*1024*1024,files:1} });
    if (!file) return reply.code(400).send({error:'A document file is required'});
    if (!allowed.has(file.mimetype)) return reply.code(415).send({error:'Unsupported document type'});
    const buffer = await file.toBuffer();
    const ext = path.extname(file.filename).toLowerCase() || '.bin';
    const key = `${request.user.id}/${randomUUID()}${ext}`;
    const dir = process.env.STORAGE_DIR ?? './storage';
    await mkdir(path.join(dir, request.user.id), {recursive:true});
    await writeFile(path.join(dir, key), buffer, {flag:'wx'});
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const document = await app.prisma.document.create({data:{userId:request.user.id,title:file.filename,documentType:file.mimetype==='application/pdf'?'PDF':file.mimetype.startsWith('image/')?'IMAGE':'TEXT',mimeType:file.mimetype,fileSize:buffer.length,storageKey:key,status:'UPLOADED'}});
    await app.prisma.documentVersion.create({data:{documentId:document.id,version:1,storageKey:key,checksum}});
    return reply.code(201).send(document);
  });
}
