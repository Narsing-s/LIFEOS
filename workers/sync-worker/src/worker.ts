import { PrismaClient, Prisma } from '@prisma/client';
import { decryptSecret, encryptSecret } from './crypto.js';

const db = new PrismaClient();
type Connection = { id: string; user_id: string; provider: string; access_token_encrypted: string; refresh_token_encrypted: string | null };
type GooglePage<T> = { nextPageToken?: string; [key: string]: unknown } & T;

async function refreshGoogle(connection: Connection) {
  const access = decryptSecret(connection.access_token_encrypted);
  const row = await db.$queryRaw<any[]>(Prisma.sql`SELECT token_expires_at FROM integration_connections WHERE id=${connection.id}`);
  const expires = row[0]?.token_expires_at ? new Date(row[0].token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return access;
  if (!connection.refresh_token_encrypted || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return access;
  const refresh = decryptSecret(connection.refresh_token_encrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`Google refresh failed: ${response.status}`);
  const token = await response.json() as { access_token: string; expires_in?: number };
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
  await db.$executeRaw(Prisma.sql`UPDATE integration_connections SET access_token_encrypted=${encryptSecret(token.access_token)}, token_expires_at=${expiresAt}, updated_at=now() WHERE id=${connection.id}`);
  return token.access_token;
}

async function googleJson(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://www.googleapis.com/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Google API ${response.status}: ${path}`);
  return response.json() as Promise<any>;
}

async function importCalendar(connection: Connection, token: string) {
  let imported = 0;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ maxResults: '2500', singleEvents: 'true', orderBy: 'startTime' });
    if (pageToken) query.set('pageToken', pageToken);
    const calendar = await googleJson(`calendar/v3/calendars/primary/events?${query}`, token);
    for (const event of calendar.items ?? []) {
      if (!event.id || !event.summary) continue;
      await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,description,occurred_at,end_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'CALENDAR',${event.summary},${event.description ?? null},${new Date(event.start?.dateTime ?? event.start?.date ?? Date.now())},${event.end?.dateTime ? new Date(event.end.dateTime) : null},'GOOGLE',${event.id},${JSON.stringify({ calendarId: 'primary', htmlLink: event.htmlLink ?? null })}::jsonb) ON CONFLICT (user_id, source_provider, source_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,occurred_at=EXCLUDED.occurred_at,end_at=EXCLUDED.end_at,metadata=EXCLUDED.metadata`);
      imported++;
    }
    pageToken = calendar.nextPageToken ?? '';
  } while (pageToken);
  return imported;
}

async function importDrive(connection: Connection, token: string) {
  let imported = 0;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100', orderBy: 'modifiedTime desc', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)' });
    if (pageToken) query.set('pageToken', pageToken);
    const drive = await googleJson(`drive/v3/files?${query}`, token);
    for (const file of drive.files ?? []) {
      if (!file.id || !file.name) continue;
      await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,occurred_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'DRIVE_FILE',${file.name},${new Date(file.modifiedTime ?? Date.now())},'GOOGLE',${file.id},${JSON.stringify({ mimeType: file.mimeType, webViewLink: file.webViewLink ?? null })}::jsonb) ON CONFLICT (user_id, source_provider, source_id) DO UPDATE SET title=EXCLUDED.title,occurred_at=EXCLUDED.occurred_at,metadata=EXCLUDED.metadata`);
      imported++;
    }
    pageToken = drive.nextPageToken ?? '';
  } while (pageToken);
  return imported;
}

async function importGmail(connection: Connection, token: string) {
  let imported = 0;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ maxResults: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const gmail = await googleJson(`gmail/v1/users/me/messages?${query}`, token);
    for (const message of gmail.messages ?? []) {
      if (!message.id) continue;
      const detail = await googleJson(`gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token);
      const headers = Object.fromEntries((detail.payload?.headers ?? []).map((h: any) => [String(h.name).toLowerCase(), h.value]));
      await db.$executeRaw(Prisma.sql`INSERT INTO inbox_items(user_id,source_provider,source_id,kind,title,content,received_at,metadata) VALUES(${connection.user_id},'GOOGLE_GMAIL',${message.id},'EMAIL',${headers.subject ?? '(no subject)'},${headers.snippet ?? null},${headers.date ? new Date(headers.date) : new Date()},${JSON.stringify({ threadId: detail.threadId ?? null, from: headers.from ?? null })}::jsonb) ON CONFLICT (user_id, source_provider, source_id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,received_at=EXCLUDED.received_at,metadata=EXCLUDED.metadata`);
      imported++;
    }
    pageToken = gmail.nextPageToken ?? '';
  } while (pageToken);
  return imported;
}

async function importContacts(connection: Connection, token: string) {
  let imported = 0;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '1000', personFields: 'names,emailAddresses,phoneNumbers,organizations' });
    if (pageToken) query.set('pageToken', pageToken);
    const people = await googleJson(`https://people.googleapis.com/v1/people/me/connections?${query}`, token);
    for (const person of people.connections ?? []) {
      const name = person.names?.[0]?.displayName ?? person.emailAddresses?.[0]?.value ?? person.resourceName;
      if (!person.resourceName || !name) continue;
      await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,occurred_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'CONTACT',${name},now(),'GOOGLE_CONTACTS',${person.resourceName},${JSON.stringify({ emails: person.emailAddresses ?? [], phones: person.phoneNumbers ?? [], organizations: person.organizations ?? [] })}::jsonb) ON CONFLICT (user_id, source_provider, source_id) DO UPDATE SET title=EXCLUDED.title,metadata=EXCLUDED.metadata`);
      imported++;
    }
    pageToken = people.nextPageToken ?? '';
  } while (pageToken);
  return imported;
}

async function importPhotos(connection: Connection, token: string) {
  let imported = 0;
  let pageToken = '';
  do {
    const body: Record<string, unknown> = { pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;
    const photos = await googleJson('https://photoslibrary.googleapis.com/v1/mediaItems:search', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const media of photos.mediaItems ?? []) {
      if (!media.id || !media.filename) continue;
      const created = media.mediaMetadata?.creationTime ? new Date(media.mediaMetadata.creationTime) : new Date();
      await db.$executeRaw(Prisma.sql`INSERT INTO timeline_events(user_id,event_type,title,occurred_at,source_provider,source_id,metadata) VALUES(${connection.user_id},'PHOTO',${media.filename},${created},'GOOGLE_PHOTOS',${media.id},${JSON.stringify({ mimeType: media.mimeType ?? null, productUrl: media.productUrl ?? null, width: media.mediaMetadata?.width ?? null, height: media.mediaMetadata?.height ?? null })}::jsonb) ON CONFLICT (user_id, source_provider, source_id) DO UPDATE SET title=EXCLUDED.title,occurred_at=EXCLUDED.occurred_at,metadata=EXCLUDED.metadata`);
      imported++;
    }
    pageToken = photos.nextPageToken ?? '';
  } while (pageToken);
  return imported;
}

async function syncGoogle(connection: Connection, runId: string) {
  const token = await refreshGoogle(connection);
  let imported = 0;
  const errors: string[] = [];
  const providers: Array<[string, () => Promise<number>]> = [
    ['calendar', () => importCalendar(connection, token)],
    ['drive', () => importDrive(connection, token)],
    ['gmail', () => importGmail(connection, token)],
    ['contacts', () => importContacts(connection, token)],
    ['photos', () => importPhotos(connection, token)],
  ];
  for (const [name, importer] of providers) {
    try { imported += await importer(); } catch (e) { errors.push(`${name}: ${(e as Error).message}`); }
  }
  await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status=${errors.length && imported === 0 ? 'FAILED' : 'COMPLETED'},finished_at=now(),imported_count=${imported},error_count=${errors.length},error=${errors.length ? errors.join('\n') : null} WHERE id=${runId}`);
  await db.$executeRaw(Prisma.sql`UPDATE integration_connections SET last_synced_at=now(),status='CONNECTED',updated_at=now() WHERE id=${connection.id}`);
}

async function processRun(run: any) {
  await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status='RUNNING',started_at=COALESCE(started_at,now()) WHERE id=${run.id}`);
  try {
    const rows = await db.$queryRaw<Connection[]>(Prisma.sql`SELECT id,user_id,provider,access_token_encrypted,refresh_token_encrypted FROM integration_connections WHERE id=${run.connection_id} AND status='CONNECTED' LIMIT 1`);
    const connection = rows[0];
    if (!connection) throw new Error('Connected integration no longer exists');
    if (connection.provider === 'GOOGLE') await syncGoogle(connection, run.id);
    else throw new Error(`Unsupported sync provider: ${connection.provider}`);
  } catch (e) {
    await db.$executeRaw(Prisma.sql`UPDATE sync_runs SET status='FAILED',finished_at=now(),error_count=1,error=${(e as Error).message} WHERE id=${run.id}`);
  }
}

async function loop() {
  const runs = await db.$queryRaw<any[]>(Prisma.sql`SELECT id,connection_id FROM sync_runs WHERE status='QUEUED' ORDER BY created_at ASC LIMIT 3`);
  for (const run of runs) await processRun(run);
}

console.log('LIFEOS sync worker started');
setInterval(() => loop().catch(err => console.error('sync loop', err)), 3000);
await loop();
