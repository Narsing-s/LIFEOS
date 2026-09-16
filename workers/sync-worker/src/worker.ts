import { PrismaClient, Prisma } from '@prisma/client';
import { decryptSecret, encryptSecret } from './crypto.js';

const db = new PrismaClient();
type Connection = { id:string; user_id:string; provider:string; access_token_encrypted:string; refresh_token_encrypted:string|null };

async function refreshGoogle(connection: Connection) {
  const access = decryptSecret(connection.access_token_encrypted);
  const row = await db.$queryRaw<any[]>(Prisma.sql`SELECT token_expires_at FROM integration_connections WHERE id=${connection.id}`);
  const expires = row[0]?.token_expires_at ? new Date(row[0].token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return access;
  if (!connection.refresh_token_encrypted || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return access;
  const refresh = decryptSecret(connection.refresh_token_encrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'}) });
  if (!response.ok) throw new Error(`Google refresh failed: ${response.status}`);
  const token = await response.json() as {access_token:string;expires_in?:number};
  const expiresAt = token.expires_in ? new Date(Date.now()+token.expires_in*1000) : null;
  await db.$executeRaw(Prisma.sql`UPDATE integration_connections SET access_token_encrypted=${encryptSecret(token.access_token)}, token_expires_at=${expiresAt}, updated_at=now() WHERE id=${connection.id}`);
  return token.access_token;
}
async function googleJson(path:string, token:string) { const response=await fetch(`https://www.googleapis.com/${path}`,{headers:{Authorization:`Bearer ${token}`}}); if(!response.ok)throw new Error(`Google API ${response.status}: ${path}`); return response.json() as Promise<any>; }
async function syncGoogle(connection:Connection,runId:string){
  const token=await refreshGoogle(connection);let imported=0;const errors:string[]=[];const now=new Date();
  try{const calendar=await googleJson('calendar/v3/calendars/primary/events?maxResults=50&singleEvents=true&orderBy=startTime',token);for(const event of calendar.items??[]){if(!event.id||!event.summary)continue;await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,description,occurred_at,end_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'CALENDAR',${event.summary},${event.description??null},${new Date(event.start?.dateTime??event.start?.date??now)},${event.end?.dateTime?new Date(event.end.dateTime):null},'GOOGLE',${event.id},${JSON.stringify({calendarId:'primary',htmlLink:event.htmlLink??null})}::jsonb) ON CONFLICT DO NOTHING`);imported++;}}catch(e){errors.push(`calendar: ${(e as Error).message}`)}
  try{const drive=await googleJson('drive/v3/files?pageSize=50&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)',token);for(const file of drive.files??[]){if(!file.id||!file.name)continue;await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,occurred_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'DRIVE_FILE',${file.name},${new Date(file.modifiedTime??now)},'GOOGLE',${file.id},${JSON.stringify({mimeType:file.mimeType,webViewLink:file.webViewLink??null})}::jsonb) ON CONFLICT DO NOTHING`);imported++;}}catch(e){errors.push(`drive: ${(e as Error).message}`)}
  try{const gmail=await googleJson('gmail/v1/users/me/messages?maxResults=25',token);for(const message of gmail.messages??[]){if(!message.id)continue;const detail=await googleJson(`gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,token);const headers=Object.fromEntries((detail.payload?.headers??[]).map((h:any)=>[h.name.toLowerCase(),h.value]));await db.$executeRaw(Prisma.sql`INSERT INTO inbox_items(user_id,source_provider,source_id,subject,sender,received_at,metadata) VALUES(${connection.user_id},'GOOGLE_GMAIL',${message.id},${headers.subject??'(no subject)'},${headers.from??null},${headers.date?new Date(headers.date):now},${JSON.stringify({threadId:detail.threadId??null})}::jsonb) ON CONFLICT DO NOTHING`);imported++;}}catch(e){errors.push(`gmail: ${(e as Error).message}`)}
  await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status=${errors.length&&imported===0?'FAILED':'COMPLETED'},completed_at=now(),records_imported=${imported},error_message=${errors.length?errors.join('\n'):null} WHERE id=${runId}`);await db.$executeRaw(Prisma.sql`UPDATE integration_connections SET last_synced_at=now(),status='CONNECTED',updated_at=now() WHERE id=${connection.id}`);
}
async function processRun(run:any){await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status='RUNNING',started_at=COALESCE(started_at,now()) WHERE id=${run.id}`);try{const rows=await db.$queryRaw<Connection[]>(Prisma.sql`SELECT id,user_id,provider,access_token_encrypted,refresh_token_encrypted FROM integration_connections WHERE id=${run.connection_id} AND status='CONNECTED' LIMIT 1`);const connection=rows[0];if(!connection)throw new Error('Connected integration no longer exists');if(connection.provider==='GOOGLE')await syncGoogle(connection,run.id);else throw new Error(`Unsupported sync provider: ${connection.provider}`)}catch(e){await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status='FAILED',completed_at=now(),error_message=${(e as Error).message} WHERE id=${run.id}`)}}
async function loop(){const runs=await db.$queryRaw<any[]>(Prisma.sql`SELECT id,connection_id FROM sync_runs WHERE status='QUEUED' ORDER BY started_at NULLS FIRST,created_at ASC LIMIT 3`);for(const run of runs)await processRun(run)}
console.log('LIFEOS sync worker started');setInterval(()=>loop().catch(err=>console.error('sync loop',err)),3000);await loop();
