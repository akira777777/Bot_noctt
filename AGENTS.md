# AGENTS.md

Guidance for Codex (Codex.ai/code) when working in this repository.

## Commands

### Bot + API (root)

- `npm start` — Start `index.js` (Telegraf bot + Express API + schedulers)
- `npm run dev` — Start with Node.js watch
- `npm test` — Run all tests (Node.js native test runner)
- `npm run test:coverage` — Run tests with coverage thresholds
- `npm run lint` — Node syntax/type checks for key entrypoints
- `npm run smoke:api` — Start the API and verify `GET /healthz` + `GET /api/catalog`

### Web dashboard (`web/`, Next.js)

- `npm run dev:web` — Start Next.js dev server
- `npm run build:web` — Build Next.js production bundle
- `npm run preview:web` — Preview the production build locally

### Database

- `npm run backup` — Create SQLite backup(s) in `backups/`
- `npm run restore-check` — Verify latest (or a specific) backup integrity

Example (verify a specific file):

```bash
npm run restore-check -- backups/bot.sqlite.<timestamp>
```

## Architecture

1. Entry point: `index.js`
   - Creates/opens SQLite via `src/db/sqlite.js`
   - Applies migrations from `src/db/migrations/` (JS modules) and seeds `products` if empty
   - Builds services + repository layer from `src/services/*` and `src/repositories/*`
   - Creates Telegraf bot handlers in `src/bot.js` + `src/handlers/*`
   - Starts Express API via `src/web/server.js`
   - Uses `TELEGRAM_DELIVERY_MODE` as the source of truth; webhook requires a usable `WEBHOOK_DOMAIN`

2. Telegram state
   - Multi-step client lead flow stored in SQLite `sessions`
   - Admin selected client stored in SQLite `admin_state`

3. Express API
   - Health check: `GET /healthz`
   - Public endpoints: `GET /api/catalog`, `GET /api/lead/track/:token/status`, `POST /api/lead`
   - Admin endpoints: `GET/PATCH /api/admin/*` protected by `X-Api-Key`; in production without `API_SECRET` they fail closed

4. Web dashboard (`web/`)
   - Next.js UI
   - Public API calls use `web/lib/api.ts`
   - Server-side admin API calls use `web/lib/admin-api.ts`
   - Client-side admin mutations go through internal Next route handlers under `web/app/api/admin/*`

## Environment Configuration

Required (see `.env.example`):

- `BOT_TOKEN`
- `ADMIN_ID` (positive integer)

Common:

- `DB_PATH` (default: `data/bot.sqlite`)
- `PORT` (default: `3000`)
- `API_SECRET` (required in production if admin HTTP API must stay available)
- `CORS_ORIGIN` (optional; strict CORS when set)
- `TELEGRAM_DELIVERY_MODE` (`polling` or `webhook`)
- `WEBHOOK_DOMAIN` (required when `TELEGRAM_DELIVERY_MODE=webhook`)
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`
- `LOG_LEVEL` / `LOG_FORMAT`
- `MEMORY_LIMIT_WARN` / `MEMORY_LIMIT_CRITICAL`
- `API_COMPRESSION`

Local dev loads `.env.local` first (then falls back to `.env`).

## Telegram Workflows

### Client Flow (lead submission)

1. Deep-link entry: `from_channel`, `quote_channel`, `support_channel`, `catalog_channel`
2. Choose product (+ quantity / quote logic)
3. Optional comment/questions
4. Choose contact method
5. Confirm submission → lead saved, admin gets notification

### Admin Commands

- `/start`
- `/dialogs`
- `/clients`
- `/leads`
- `/setclient <id>`
- `/stop`
