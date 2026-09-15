# LIFEOS Production Architecture

## Principles

1. PostgreSQL is the source of truth; the LLM is not a database.
2. Every user-owned resource is scoped by `user_id` and authorization is enforced before data access.
3. Heavy document and AI processing runs asynchronously through workers.
4. AI uses explicit application tools, never unrestricted SQL or database credentials.
5. Search combines structured filters, PostgreSQL full-text search and vector retrieval.
6. Every important operation emits an event and security-sensitive actions are audited.
7. V1 is a modular monolith plus workers; microservices can be extracted later.

## Runtime

```text
Web / Mobile
     |
     v
API (Fastify)
  |     |      |
 Auth  Life   AI Orchestrator
  |     |      |
  +-----+------+----> PostgreSQL
        |             pgvector
        +-----------> Redis/BullMQ
        +-----------> Object Storage

Workers: document processing, AI/embeddings, notifications
```

## Core domains

Identity, Documents, Search, Memories, Tasks, Reminders, Assets, Warranties, Expenses, Trips, Conversations, Entities/Relationships, Audit.

## AI request flow

```text
User message -> intent/tool selection -> authorization -> retrieval -> context -> model -> source-backed answer -> optional action
```

## Production boundaries

- Web and API are stateless.
- Database, object storage and queue are externalized in production.
- Secrets are injected through environment/secret management.
- AI endpoints have independent rate and usage limits.
- Sensitive data is encrypted where appropriate and access is audited.
