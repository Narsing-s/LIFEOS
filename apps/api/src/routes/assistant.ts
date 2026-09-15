import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const input = z.object({ conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(4000) });

function answer(message: string, data: any) {
  const q = message.toLowerCase();
  if (q.includes('task') || q.includes('today') || q.includes('todo')) return `You have ${data.tasks.length} open task${data.tasks.length === 1 ? '' : 's'}.`;
  if (q.includes('document') || q.includes('passport') || q.includes('receipt')) return data.documents.length ? `I found ${data.documents.length} matching document${data.documents.length === 1 ? '' : 's'}.` : 'I could not find a matching document.';
  if (q.includes('warranty') || q.includes('laptop') || q.includes('asset')) return data.assets.length ? `I found ${data.assets.length} related asset${data.assets.length === 1 ? '' : 's'}. Check the source details below for warranty dates.` : 'I could not find a matching asset yet.';
  if (q.includes('memory') || q.includes('remember')) return data.memories.length ? `I found ${data.memories.length} relevant memories.` : 'You have not saved a matching memory yet.';
  return `I searched your LIFEOS data and found ${data.documents.length} documents, ${data.memories.length} memories, ${data.tasks.length} tasks and ${data.assets.length} assets related to your request.`;
}

export async function assistantRoutes(app: FastifyInstance) {
  app.post('/chat', { preHandler: requireAuth }, async (request, reply) => {
    const body = input.parse(request.body);
    const uid = request.user.id;
    const [documents, memories, tasks, assets] = await Promise.all([
      app.prisma.document.findMany({ where:{userId:uid,deletedAt:null,OR:[{title:{contains:body.message,mode:'insensitive'}},{documentType:{contains:body.message,mode:'insensitive'}}]}, take:10, select:{id:true,title:true,documentType:true,status:true} }),
      app.prisma.memory.findMany({ where:{userId:uid,OR:[{title:{contains:body.message,mode:'insensitive'}},{content:{contains:body.message,mode:'insensitive'}}]}, take:10, select:{id:true,title:true,type:true,content:true} }),
      app.prisma.task.findMany({ where:{userId:uid,status:{not:'COMPLETED'},OR:[{title:{contains:body.message,mode:'insensitive'}},{description:{contains:body.message,mode:'insensitive'}}]}, take:10, select:{id:true,title:true,status:true,dueAt:true} }),
      app.prisma.asset.findMany({ where:{userId:uid,OR:[{name:{contains:body.message,mode:'insensitive'}},{brand:{contains:body.message,mode:'insensitive'}},{model:{contains:body.message,mode:'insensitive'}}]}, take:10, include:{warranties:true} })
    ]);
    const conversation = body.conversationId ? await app.prisma.conversation.findFirst({where:{id:body.conversationId,userId:uid}}) : await app.prisma.conversation.create({data:{userId:uid,title:body.message.slice(0,80)}});
    if (!conversation) return reply.code(404).send({error:'Conversation not found'});
    await app.prisma.message.create({data:{conversationId:conversation.id,role:'USER',content:body.message}});
    const text=answer(body.message,{documents,memories,tasks,assets});
    const assistant=await app.prisma.message.create({data:{conversationId:conversation.id,role:'ASSISTANT',content:text,metadata:{sources:{documents:documents.map(x=>x.id),memories:memories.map(x=>x.id),tasks:tasks.map(x=>x.id),assets:assets.map(x=>x.id)}}}});
    return {conversationId:conversation.id,message:assistant,sources:{documents,memories,tasks,assets},actions:[]};
  });
}
