# Quickstart — Multi-role Telegram Journaling Assistant

## 1. Prerequisites

- Node.js 20.9+ with corepack enabled
- Yarn or npm (align with repo defaults; current scripts assume `npm`)
- PostgreSQL 15+ with `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)
- Writable filesystem volume for encrypted document storage (configurable path)
- Two Telegram bot tokens (one for admin configuration, one for end users)
- Ollama runtime accessible for embedding generation (or configure remote endpoint)

## 2. Environment Configuration

1. Copy `.env.example` → `.env` (create the example if missing) and populate:
   - `DATABASE_URL=postgres://USER:PASS@HOST:PORT/journal_mastra`
   - `DOCUMENT_STORAGE_ROOT=/var/lib/journal-mastra/docs`
   - `ADMIN_BOT_TOKEN=...`
   - `USER_BOT_TOKEN=...`
   - `OLLAMA_BASE_URL=http://localhost:11434`
   - `EMBEDDING_MODEL=all-minilm`
2. Ensure the filesystem path in `DOCUMENT_STORAGE_ROOT` is encrypted (e.g., LUKS/LVM or cloud KMS).

## 3. Install Dependencies

```bash
npm install
```

## 4. Database Bootstrap

1. Run bootstrap script (to be added) that applies base schema:

```bash
npm run db:migrate
```

2. Verify `pgvector` is active:

```bash
psql $DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

## 5. Start Mastra Dev Server

```bash
npm run dev
```

The Mastra dev server exposes agent endpoints and telemetry UI. Hot reload picks up changes to agents, tools, and workflows under `src/mastra/`.

## 6. Telegram Webhook / Polling

- For local testing, run a tunneling tool (ngrok/Cloudflare) and configure Telegram webhook URLs.
- Alternatively, enable long-polling within the bot adapters (documented in future implementation tasks).

## 7. Seed Sample Catalogue (Optional)

Use the admin bot to send a configuration prompt, e.g.:

```
Track water intake (quantity in ml, logged_at timestamp) and medications (name, dosage mg, taken_at time, supply_remaining integer). Remind water every 2 hours from 08:00-20:00 and medications per dosage schedule.
```

Confirm that the `catalogueSchemaTool` creates `journal_water_intake` and `journal_medications` tables plus reminder rules.

## 8. Run Manual Validation Flow

Follow `manual-validation.md` for end-to-end verification. Capture transcripts, database snapshots, and audit logs as evidence before marking the feature complete.
