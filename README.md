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
- Google OAuth connection foundation
- Encrypted provider-token storage with a dedicated production encryption key
- Timeline, universal inbox, finance, notifications and automation data models
- Sync lifecycle/history APIs
- CI typecheck + build validation
- Installable web-app/PWA metadata

## Architecture

`Web / Mobile / Desktop → API/BFF → Identity + Life + AI Orchestrator → Documents/Search/Memory → PostgreSQL + Object Storage + Vector Index + Redis → Integrations`

## Repository layout

- `apps/api` — REST API and AI orchestration
- `apps/web` — web client
- `apps/mobile` — reserved for the mobile client
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

## Production readiness

Before a public production launch, verify every item below with the target deployment configuration:

- [ ] Set a unique random `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY` (never commit secrets).
- [ ] Configure Google OAuth redirect URI and required APIs in Google Cloud.
- [ ] Replace local MinIO/filesystem storage with durable S3-compatible storage.
- [ ] Use managed PostgreSQL/pgvector and Redis with backups/retention.
- [ ] Configure TLS, secure cookies/token storage and a strict production web origin.
- [ ] Run database migrations as a controlled deployment step.
- [ ] Run API/web typecheck, build, unit tests and browser E2E tests against staging.
- [ ] Add alerting/metrics for sync failures, queue depth, API errors and database health.
- [ ] Verify provider disconnect/revocation and deletion/export flows.
- [ ] Verify Google Calendar/Drive/Gmail/Photos/Contacts imports with real test accounts and current provider API permissions.
- [ ] Implement and verify the mobile/offline client if mobile is part of the launch scope.

Provider credentials and external APIs are intentionally not bundled into the repository. A connected-provider feature is not considered production-ready until its real API import, refresh, retry, deduplication and deletion behavior has been tested in staging.

See `docs/architecture/overview.md`, `docs/api/openapi.yaml`, and `docs/product/v1.md` for deeper contracts.
