# Quickstart — Multi-role Telegram Journaling Assistant

## 1. Prerequisites

- Node.js 20.9+ with corepack enabled
- npm (repo scripts assume `npm`)
- PostgreSQL 15+ with `pgvector` installed (`CREATE EXTENSION IF NOT EXISTS vector;`)
- Prisma CLI (`npx prisma` via dev dependency) and generated client
- Writable, encrypted filesystem volume for document storage (`DOCUMENT_STORAGE_ROOT`)
- Two Telegram bot tokens (admin configuration bot + user journaling bot)
- Ollama runtime (local or remote) for embeddings and document Q&A grounding

## 2. Environment Configuration

1. Copy `.env.example` → `.env` and populate:
   - `DATABASE_URL=postgres://USER:PASS@HOST:PORT/journal_mastra`
   - `DOCUMENT_STORAGE_ROOT=/var/lib/journal-mastra/docs`
   - `ADMIN_BOT_TOKEN=...`
   - `USER_BOT_TOKEN=...`
   - `OLLAMA_BASE_URL=http://localhost:11434`
   - `EMBEDDING_MODEL=all-minilm`
   - `TELEGRAM_WEBHOOK_URL` / `TELEGRAM_POLLING_MODE` (once adapters are wired)
2. Ensure `DOCUMENT_STORAGE_ROOT` resides on an encrypted volume (LUKS, cloud KMS, etc.).

## 3. Install Dependencies & Generate Prisma Client

```bash
npm install
npx prisma generate
```

## 4. Database Bootstrap (Prisma + Extensions)

1. Apply baseline Prisma migrations (core catalogue metadata, reminders, documents, audit logs):

```bash
npx prisma migrate deploy
```

2. Confirm `pgvector` is available:

```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

3. (Optional) Seed development data once seeding script lands:

```bash
npm run db:seed
```

## 5. Start Mastra Dev Server

```bash
npm run dev
```

The Mastra dev server exposes agent endpoints and telemetry. Hot reload covers agents, tools, workflows, and Prisma-backed utilities under `src/mastra/`.

## 6. Telegram Webhook / Polling

- For local testing, tunnel via ngrok/Cloudflare and register webhook URLs for both bots.
- Alternatively, enable long-polling adapters (implementation detail tracked in upcoming tasks) while in development.

## 7. Seed Sample Catalogue (Optional)

Send the admin bot a configuration prompt, e.g.:

```
Track water intake (quantity numeric ml, logged_at timestamp) and medications (drug_name text, dosage_mg numeric, taken_at timestamp, supply_remaining integer). Remind water every 2 hours 08:00-20:00 local time; remind medications at 21:00 with caregiver escalation if missed.
```

Expect the `catalogueSchemaTool` to create `journal_water_intake` and `journal_medications` tables (via Prisma DDL), add catalogue metadata, and register reminder rules.

## 8. Run Manual Validation Flow

Follow `manual-validation.md` end-to-end: capture Telegram transcripts, Prisma query outputs, schema audit events, and document-grounded answers before marking the feature complete.
