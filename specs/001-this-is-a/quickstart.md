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
npm run db:generate
```

## 4. Database Bootstrap (Prisma + Extensions)

1. Apply baseline Prisma migrations (core catalogue metadata, reminders, documents, audit logs):

```bash
npm run db:migrate:dev
```

2. Confirm `pgvector` is available:

```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

3. Bootstrap sample catalogue and demonstration data:

```bash
npm run bootstrap:admin-rule-set
```

This creates a complete demonstration environment with:

- Sample health tracking categories (water intake, medication, exercise)
- Dynamic journal tables with proper field schemas
- Configured reminder rules with escalation policies
- Audit trail for all operations

## 5. Start Mastra Dev Server

```bash
npm run dev
```

The Mastra dev server exposes agent endpoints and telemetry. Hot reload covers agents, tools, workflows, and Prisma-backed utilities under `src/mastra/`.

## 6. Telegram Webhook / Polling

- For local testing, tunnel via ngrok/Cloudflare and register webhook URLs for both bots.
- Alternatively, enable long-polling adapters (implementation detail tracked in upcoming tasks) while in development.

## 7. Admin Agent Configuration Walkthrough

### Testing the Admin Catalogue Agent

With the bootstrap data in place, you can now test the admin agent with natural language configuration:

```bash
# Start the Mastra service if not already running
npm run dev
```

The admin agent (`adminCatalogueAgent`) is now available and can process natural language catalogue configurations like:

```
Add mood tracking: daily mood (1-10 scale), energy_level (low/medium/high), notes (optional text).
Remind at 9 PM daily with caregiver escalation after 2 hours.
Tag as mental_health, wellness.
```

The agent will:

1. Parse the natural language input using the `catalogueSchemaTool`
2. Create/update catalogue metadata in PostgreSQL
3. Generate dynamic journal tables (e.g., `journal_mood_tracking`)
4. Configure reminder rules with specified escalation policies
5. Create comprehensive audit trails

### Sample Journal Entry Processing

Test journal entry processing with the `journalWriterTool`:

```json
{
  "userId": "user123",
  "telegramMessageId": "msg456",
  "receivedAt": "2024-10-04T10:30:00Z",
  "catalogueItemSlug": "water-intake",
  "parsedFields": [
    { "name": "quantity", "value": 3, "confidence": 0.95 },
    { "name": "water_type", "value": "filtered", "confidence": 0.8 }
  ],
  "freeformNotes": "Had water with lunch"
}
```

## 8. Run Manual Validation Flow

Follow `manual-validation.md` end-to-end: capture Telegram transcripts, Prisma query outputs, schema audit events, and document-grounded answers before marking the feature complete.
