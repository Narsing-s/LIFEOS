# LIFEOS

**Everything about your life. One intelligent place.**

LIFEOS is a privacy-first personal operating system that connects documents, memories, tasks, reminders, assets, expenses and conversations into one searchable personal knowledge layer.

## Product loop

**Capture → Understand → Connect → Search → Ask → Act → Remember**

## Current capabilities

- JWT authentication and account creation
- PostgreSQL + Prisma data model
- User-scoped universal search
- Tasks, memories, assets, expenses and documents
- Assistant retrieval with user-scoped source IDs
- Responsive web dashboard
- Google OAuth with encrypted provider-token storage and real provider sync workers
- Google Calendar, Drive, Gmail, Contacts and Photos metadata imports with deduplication and token refresh
- Timeline, universal inbox, finance, notifications and automation APIs
- Sync lifecycle/history APIs and readiness monitoring
- CI typecheck + test + build validation
- Installable web-app/PWA metadata
- Expo-based Android/iOS mobile client foundation with secure token storage and life overview

## Architecture

`Web / Mobile / Desktop → API/BFF → Identity + Life + AI Orchestrator → Documents/Search/Memory → PostgreSQL + Object Storage + Vector Index + Redis → Integrations`

## Repository layout

- `apps/api` — REST API and AI orchestration
- `apps/web` — web client
- `apps/mobile` — Expo Android/iOS client
- `workers/*` — asynchronous processing
- `packages/database` — Prisma schema and database access
- `packages/shared` — shared types/constants
- `packages/validation` — API validation
- `packages/api-client` — typed client
- `packages/ui` — shared UI primitives
- `docs` — architecture, API, security and product documentation

## Development

Requirements: Node.js 20+, pnpm 9+, Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: `http://localhost:5173`
API health: `http://localhost:4000/health`
API readiness: `http://localhost:4000/ready`

For a physical mobile device, set `EXPO_PUBLIC_API_URL` or the Expo app config API URL to an address reachable from the device instead of `localhost`.

## Production readiness

Before a public production launch, verify every item below with the target deployment configuration:

- [ ] Set unique random `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY`; production startup now rejects missing secrets.
- [ ] Configure a managed PostgreSQL URL; production startup rejects a missing database URL.
- [ ] Configure an HTTPS `WEB_ORIGIN`; production startup rejects the localhost origin.
- [ ] Configure Google OAuth redirect URI and required APIs in Google Cloud.
- [ ] Replace local MinIO/filesystem storage with durable S3-compatible storage.
- [ ] Use managed PostgreSQL/pgvector and Redis with backups/retention.
- [ ] Configure TLS, secure cookies/token storage and strict production origin.
- [ ] Run database migrations as a controlled deployment step.
- [ ] Run API/web/mobile typecheck, build, unit tests and browser/device E2E tests against staging.
- [ ] Add alerting/metrics for sync failures, queue depth, API errors and database health.
- [ ] Verify provider disconnect/revocation and deletion/export flows.
- [ ] Verify Google Calendar/Drive/Gmail/Photos/Contacts imports with real test accounts and current provider API permissions.
- [ ] Configure mobile release signing, Android/iOS app-store metadata, push notifications and offline sync before mobile store launch.

Provider credentials and external APIs are intentionally not bundled into the repository. A connected-provider feature is not considered production-ready until its real API import, refresh, retry, deduplication and deletion behavior has been tested in staging.

See `docs/architecture/overview.md`, `docs/api/openapi.yaml`, and `docs/product/v1.md` for deeper contracts.
