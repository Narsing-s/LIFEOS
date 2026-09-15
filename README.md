# LIFEOS

**Everything about your life. One intelligent place.**

LIFEOS is a privacy-first personal operating system that connects documents, memories, tasks, reminders, assets, expenses and conversations into one searchable personal knowledge layer.

## Product loop

**Capture → Understand → Connect → Search → Ask → Act → Remember**

## V1

- Secure authentication
- Personal dashboard
- Document upload and processing
- OCR/extraction pipeline
- Universal personal search
- Personal memories
- Tasks and reminders
- Assets and warranties
- AI life assistant with source citations
- Audit logging
- PostgreSQL + pgvector
- Redis/BullMQ workers
- Docker development environment
- OpenAPI contract
- Automated tests and CI

## Repository layout

- `apps/api` — REST API and AI orchestration
- `apps/web` — web client
- `apps/mobile` — future mobile client
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
pnpm db:generate
pnpm db:migrate
pnpm dev
```

See `docs/architecture/overview.md` for the production architecture.