# LIFEOS

**Everything about your life. One intelligent place.**

LIFEOS is a privacy-first personal operating system that connects documents, memories, tasks, reminders, assets, expenses and conversations into one searchable personal knowledge layer.

## Product loop

**Capture → Understand → Connect → Search → Ask → Act → Remember**

## V1 implementation

The repository now contains a working V1 foundation with:

- JWT authentication and account creation
- PostgreSQL + Prisma data model
- Personal dashboard API
- User-scoped universal search across documents, memories, tasks and assets
- Task creation and completion
- Personal memory creation/listing
- Asset and warranty data model
- Multipart document upload with size/type validation and SHA-256 checksums
- Assistant endpoint with explicit, user-scoped retrieval tools and source IDs
- Responsive LIFEOS web dashboard with sign-in, task capture and Ask Your Life
- Docker services for PostgreSQL/pgvector, Redis and MinIO
- OpenAPI contract and CI-ready monorepo structure

The AI endpoint is deliberately safe-by-default: it retrieves only records belonging to the authenticated user. A production LLM provider can be connected through the AI orchestration layer without granting the model raw database access.

## Architecture

`Web / Mobile / Desktop → API/BFF → Identity + Life + AI Orchestrator → Documents/Search/Memory → PostgreSQL + Object Storage + Vector Index + Redis → Integrations`

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
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: `http://localhost:5173`
API health: `http://localhost:4000/health`

For production, replace local filesystem storage with S3-compatible object storage, provide a managed PostgreSQL/pgvector database, use a secret manager for JWT secrets, and run document/AI/notification processing asynchronously.

See `docs/architecture/overview.md` for the production architecture and `docs/api/openapi.yaml` for the API contract.
