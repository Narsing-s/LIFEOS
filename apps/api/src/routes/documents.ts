import type { FastifyInstance } from 'fastify';
import { mkdir, rm, writeFile, createReadStream, access } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.js';

const allowed = new Set(['application/pdf','image/png','image/jpeg','text/plain','text/csv']);
const storageRoot = () => process.env.STORAGE_DIR ?? './storage';

export async function documentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', async (request, reply) => {
    const file = await request.file({ limits:{fileSize:25*1024*1024,files:1} });
    if (!file) return reply.code(400).send({error:'A document file is required'});
    if (!allowed.has(file.mimetype)) return reply.code(415).send({error:'Unsupported document type'});
    const buffer = await file.toBuffer();
    const ext = path.extname(file.filename).toLowerCase() || '.bin';
    const key = `${request.user.id}/${randomUUID()}${ext}`;
    const absolute = path.join(storageRoot(), key);
    await mkdir(path.dirname(absolute), {recursive:true});
    await writeFile(absolute, buffer, {flag:'wx'});
    const checksum = createHash('sha256').update(buffer).digest('hex');
    try {
      const document = await app.prisma.document.create({data:{userId:request.user.id,title:file.filename,documentType:file.mimetype==='application/pdf'?'PDF':file.mimetype.startsWith('image/')?'IMAGE':'TEXT',mimeType:file.mimetype,fileSize:buffer.length,storageKey:key,status:'UPLOADED'}});
      await app.prisma.documentVersion.create({data:{documentId:document.id,version:1,storageKey:key,checksum}});
      return reply.code(201).send(document);
    } catch (error) {
      await rm(absolute, {force:true}).catch(cleanupError => request.log.error({cleanupError,key}, 'Failed to clean up orphaned upload'));
      throw error;
    }
  });

  app.get('/:id/download', async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) return reply.code(400).send({error:'Document id is required'});
    const document = await app.prisma.document.findFirst({where:{id,userId:request.user.id,deletedAt:null},select:{title:true,mimeType:true,storageKey:true}});
    if (!document) return reply.code(404).send({error:'Document not found'});
    const root = path.resolve(storageRoot());
    const absolute = path.resolve(root, document.storageKey);
    if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) return reply.code(404).send({error:'Document not found'});
    try { await access(absolute); } catch { return reply.code(404).send({error:'Document content is unavailable'}); }
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.title)}`);
    reply.type(document.mimeType);
    return reply.send(createReadStream(absolute));
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id?: string };
    if (!id) return reply.code(400).send({error:'Document id is required'});
    const document = await app.prisma.document.findFirst({where:{id,userId:request.user.id,deletedAt:null},select:{id:true,storageKey:true}});
    if (!document) return reply.code(404).send({error:'Document not found'});
    await app.prisma.document.update({where:{id:document.id},data:{deletedAt:new Date(),status:'DELETED'}});
    await app.prisma.auditLog.create({data:{userId:request.user.id,actorType:'USER',action:'DOCUMENT_DELETED',resourceType:'DOCUMENT',resourceId:document.id,metadata:{storageKey:document.storageKey}}});
    const root = path.resolve(storageRoot());
    const absolute = path.resolve(root, document.storageKey);
    if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) request.log.warn({documentId:id}, 'Skipped unsafe document storage path');
    else await rm(absolute, {force:true}).catch(error => request.log.error({error,documentId:id}, 'Document metadata deleted but file cleanup failed'));
    return reply.code(204).send();
  });
}
