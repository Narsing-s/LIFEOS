import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const taskInput = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), priority: z.enum(['LOW','NORMAL','HIGH','URGENT']).default('NORMAL'), dueAt: z.string().datetime().optional() });
const memoryInput = z.object({ type: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(10000), importance: z.number().int().min(1).max(10).default(5) });
const assetInput = z.object({ name: z.string().trim().min(1).max(200), category: z.string().trim().min(1).max(80), brand: z.string().max(100).optional(), model: z.string().max(100).optional(), purchaseDate: z.string().date().optional(), purchasePrice: z.number().nonnegative().optional(), currency: z.string().length(3).default('INR') });

export async function lifeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/dashboard', async request => {
    const uid = request.user.id;
    const [tasks, reminders, documents, memories, assets, expenses] = await Promise.all([
      app.prisma.task.findMany({ where: { userId: uid, status: { not: 'COMPLETED' } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 8 }),
      app.prisma.reminder.findMany({ where: { userId: uid, status: 'PENDING' }, orderBy: { remindAt: 'asc' }, take: 8 }),
      app.prisma.document.findMany({ where: { userId: uid, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 6, select: { id:true,title:true,documentType:true,status:true,createdAt:true } }),
      app.prisma.memory.findMany({ where: { userId: uid }, orderBy: { importance: 'desc' }, take: 6 }),
      app.prisma.asset.findMany({ where: { userId: uid }, include: { warranties: { orderBy: { endDate: 'asc' }, take: 1 } }, take: 6 }),
      app.prisma.expense.aggregate({ where: { userId: uid }, _sum: { amount: true }, _count: true }),
    ]);
    return { tasks, reminders, documents, memories, assets, expenseSummary: expenses };
  });

  app.get('/tasks', async request => app.prisma.task.findMany({ where: { userId: request.user.id }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }] }));
  const reminderInput=z.object({taskId:z.string().uuid().optional(),remindAt:z.string().datetime(),channel:z.enum(['IN_APP','EMAIL','PUSH']).default('IN_APP'),repeatRule:z.string().max(120).optional()});
  app.get('/reminders', async request => app.prisma.reminder.findMany({where:{userId:request.user.id},orderBy:{remindAt:'asc'},take:100}));
  app.post('/reminders', async request => {
    const b=reminderInput.parse(request.body);
    if(b.taskId){
      const task=await app.prisma.task.findFirst({where:{id:b.taskId,userId:request.user.id}});
      if(!task) throw Object.assign(new Error('Task not found'),{statusCode:404});
    }
    return app.prisma.reminder.create({data:{userId:request.user.id,taskId:b.taskId,remindAt:new Date(b.remindAt),channel:b.channel,repeatRule:b.repeatRule}});
  });
  app.post('/reminders/:id/complete', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const r=await app.prisma.reminder.updateMany({where:{id,userId:request.user.id},data:{status:'COMPLETED'}});
    if(!r.count) throw Object.assign(new Error('Reminder not found'),{statusCode:404});
    return {ok:true};
  });
  app.delete('/reminders/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const r=await app.prisma.reminder.deleteMany({where:{id,userId:request.user.id}});
    if(!r.count) throw Object.assign(new Error('Reminder not found'),{statusCode:404});
    return {ok:true};
  });
  app.post('/tasks', async request => { const b=taskInput.parse(request.body); return app.prisma.task.create({ data:{ userId:request.user.id,title:b.title,description:b.description,priority:b.priority,dueAt:b.dueAt?new Date(b.dueAt):undefined } }); });
  app.post('/tasks/:id/complete', async request => { const id=(request.params as {id:string}).id; const r=await app.prisma.task.updateMany({ where:{id,userId:request.user.id}, data:{status:'COMPLETED',completedAt:new Date()} }); if(!r.count) throw Object.assign(new Error('Task not found'),{statusCode:404}); return {ok:true}; });
  app.patch('/tasks/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const b=taskInput.partial().parse(request.body);
    const r=await app.prisma.task.updateMany({where:{id,userId:request.user.id},data:{title:b.title,description:b.description,priority:b.priority,dueAt:b.dueAt?new Date(b.dueAt):undefined}});
    if(!r.count) throw Object.assign(new Error('Task not found'),{statusCode:404});
    return app.prisma.task.findFirst({where:{id,userId:request.user.id}});
  });
  app.delete('/tasks/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const r=await app.prisma.task.deleteMany({where:{id,userId:request.user.id}});
    if(!r.count) throw Object.assign(new Error('Task not found'),{statusCode:404});
    return {ok:true};
  });

  app.get('/memories', async request => app.prisma.memory.findMany({ where:{userId:request.user.id}, orderBy:{updatedAt:'desc'} }));
  app.post('/memories', async request => { const b=memoryInput.parse(request.body); return app.prisma.memory.create({data:{userId:request.user.id,...b}}); });
  app.patch('/memories/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const b=memoryInput.partial().parse(request.body);
    const r=await app.prisma.memory.updateMany({where:{id,userId:request.user.id},data:b});
    if(!r.count) throw Object.assign(new Error('Memory not found'),{statusCode:404});
    return app.prisma.memory.findFirst({where:{id,userId:request.user.id}});
  });
  app.delete('/memories/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const r=await app.prisma.memory.deleteMany({where:{id,userId:request.user.id}});
    if(!r.count) throw Object.assign(new Error('Memory not found'),{statusCode:404});
    return {ok:true};
  });

  app.get('/assets', async request => app.prisma.asset.findMany({where:{userId:request.user.id},include:{warranties:true},orderBy:{updatedAt:'desc'}}));
  app.post('/assets', async request => { const b=assetInput.parse(request.body); return app.prisma.asset.create({data:{userId:request.user.id,name:b.name,category:b.category,brand:b.brand,model:b.model,purchaseDate:b.purchaseDate?new Date(b.purchaseDate):undefined,purchasePrice:b.purchasePrice,currency:b.currency}}); });
  app.patch('/assets/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const b=assetInput.partial().parse(request.body);
    const r=await app.prisma.asset.updateMany({where:{id,userId:request.user.id},data:{name:b.name,category:b.category,brand:b.brand,model:b.model,purchaseDate:b.purchaseDate?new Date(b.purchaseDate):undefined,purchasePrice:b.purchasePrice,currency:b.currency}});
    if(!r.count) throw Object.assign(new Error('Asset not found'),{statusCode:404});
    return app.prisma.asset.findFirst({where:{id,userId:request.user.id},include:{warranties:true}});
  });
  app.delete('/assets/:id', async request => {
    const id=z.object({id:z.string().uuid()}).parse(request.params).id;
    const r=await app.prisma.asset.deleteMany({where:{id,userId:request.user.id}});
    if(!r.count) throw Object.assign(new Error('Asset not found'),{statusCode:404});
    return {ok:true};
  });

  app.get('/documents', async request => app.prisma.document.findMany({where:{userId:request.user.id,deletedAt:null},orderBy:{createdAt:'desc'}}));
  app.get('/search', async request => {
    const q=z.string().trim().min(1).max(200).parse((request.query as {q?:string}).q);
    const uid=request.user.id;
    const [documents, memories, tasks, assets]=await Promise.all([
      app.prisma.document.findMany({where:{userId:uid,deletedAt:null,OR:[{title:{contains:q,mode:'insensitive'}},{documentType:{contains:q,mode:'insensitive'}}]},take:20}),
      app.prisma.memory.findMany({where:{userId:uid,OR:[{title:{contains:q,mode:'insensitive'}},{content:{contains:q,mode:'insensitive'}}]},take:20}),
      app.prisma.task.findMany({where:{userId:uid,OR:[{title:{contains:q,mode:'insensitive'}},{description:{contains:q,mode:'insensitive'}}]},take:20}),
      app.prisma.asset.findMany({where:{userId:uid,OR:[{name:{contains:q,mode:'insensitive'}},{brand:{contains:q,mode:'insensitive'}},{model:{contains:q,mode:'insensitive'}}]},take:20})
    ]);
    return {query:q,results:{documents,memories,tasks,assets}};
  });
}
