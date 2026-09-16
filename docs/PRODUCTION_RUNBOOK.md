# LIFEOS Production Runbook

This checklist separates code readiness from environment readiness. A successful build does not mean external providers, backups, mobile builds, or monitoring are configured.

## Required secrets

- `DATABASE_URL`
- `JWT_SECRET` (32+ characters, unique per environment)
- `INTEGRATION_ENCRYPTION_KEY` (32+ characters, unique and backed up securely)
- `WEB_ORIGIN` set to the exact HTTPS web origin
- Google OAuth client ID/secret/redirect URI when Google integration is enabled
- `AI_API_KEY` and `AI_MODEL` when the assistant is enabled

Never commit production secrets or use the development values from `docker-compose.yml` in production.

## Database

1. Use managed PostgreSQL with pgvector support.
2. Run Prisma migrations as a controlled deployment step.
3. Enable automated backups and point-in-time recovery.
4. Perform a restore drill before launch and record the recovery time.
5. Monitor connection saturation, storage, replication/backup health, and slow queries.

## Object storage

The current development document store uses `STORAGE_DIR`. For production, use durable S3-compatible/object storage and implement lifecycle/retention rules before storing important user documents.

Verify:

- private buckets/containers
- encryption at rest
- server-side access controls
- backup/versioning policy
- deletion lifecycle
- upload/download authorization
- orphan cleanup

## Google integration

Configure the exact production redirect URI in Google Cloud. Test a real account through connect, callback, token refresh, pagination, duplicate sync, disconnect, and account deletion.

Verify Calendar, Drive, Gmail, Contacts, and Photos behavior against the scopes enabled for the production OAuth client.

## API and workers

Run API readiness checks after deployment. A healthy process is not sufficient: verify database connectivity and that the sync worker can claim and finish a real sync.

Monitor:

- API 4xx/5xx rate
- authentication failures/rate-limit events
- database errors
- sync failures and stuck jobs
- queue depth
- provider refresh failures
- storage failures

## Web

Set `VITE_API_URL` to the production API base URL before building the web application. Verify registration, login, logout, search, assistant, tasks, documents, integrations, export, and deletion in a staging environment first.

## Mobile

Set `EXPO_PUBLIC_API_URL` to the production API base URL. Configure Android package signing and iOS bundle signing/profiles. Test login, refresh, logout, network loss/recovery, and API errors on real devices.

Offline-first sync, push notifications, and store release automation remain separate launch workstreams unless they are explicitly included in the release scope.

## Privacy and deletion

Before launch, verify that account deletion removes database records and user-owned storage, revokes provider tokens where supported, and leaves no user-identifying records in application caches or logs beyond the documented retention policy.

Verify export contains user-owned application data while excluding OAuth ciphertext/secrets.

## Final staging gate

- [ ] Database migration on a clean staging database
- [ ] Backup and restore drill
- [ ] Google OAuth real-account test
- [ ] Provider token refresh test
- [ ] Sync retry/deduplication test
- [ ] Document upload/download/delete test
- [ ] Account export test
- [ ] Account deletion test
- [ ] Browser E2E test
- [ ] Android real-device test
- [ ] iOS real-device test
- [ ] Monitoring and alerts verified
- [ ] Production secrets injected by secret manager
- [ ] HTTPS and exact origin verified
