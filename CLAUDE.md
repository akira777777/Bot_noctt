# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development & Testing:**
- `npm start` — Run the Telegraf bot server (connects to Telegram API, manages conversations)
- `npm test` — Run all tests using Node.js native test runner
- `npm test -- --grep "pattern"` — Run specific test(s) matching pattern
- `npm run test:single test/filename.test.js` — Run a single test file (adjust path as needed)
- `npm run dev:web` — Start Vite dev server for the React webapp (hot reload enabled)
- `npm run build:web` — Build React webapp for production (outputs to `webapp/dist`)
- `npm run preview:web` — Preview the production build locally

**Database Management:**
- `npm run backup` — Create a SQLite backup in the `backups/` directory
- `npm run restore-check` — Verify backup integrity before restoration

## Architecture

**Three-Tier System:**

1. **Telegraf Bot Server** (index.js → `src/bot/`)
   - Listens to Telegram API for incoming messages and deep-links
   - Processes three entry points: `from_channel` (product catalog), `quote_channel` (inquiry), `support_channel` (support request), `catalog_channel` (product list)
   - Manages client conversations via command handlers (/start, /dialogs, /clients, /leads, /setclient, /stop)
   - Persists conversation state and leads to SQLite
   - Runs on port (configurable via `PORT` env var)

2. **Express Backend** (handles API requests from webapp)
   - Configured with CORS (controlled via `CORS_ORIGIN` env var)
   - Serves data endpoints for React frontend
   - Integrates with SQLite for persistence

3. **React + Vite Frontend** (webapp/)
   - Modern frontend with hot module reloading during development
   - Client-side form handling for lead submission (product selection → quantity → comment → contact method → confirmation)
   - Built and served statically in production

**Data Persistence:**
- SQLite database (file: `data/bot.db` by default, configurable via `DB_PATH`)
- Schema managed via migrations in `src/db/migrations/`
- Conversation state, client profiles, and leads tracked in normalized tables
- Backup system stores snapshots in `backups/` directory with retention policy (configurable via `BACKUP_RETENTION`)

## Environment Configuration

Required environment variables (see `.env.example`):
- `NODE_ENV` — `development` or `production`
- `BOT_TOKEN` — Telegram Bot API token (from @BotFather)
- `ADMIN_ID` — Telegram numeric ID of admin user (receives lead notifications)
- `DB_PATH` — Path to SQLite database file (default: `data/bot.db`)
- `BACKUP_RETENTION` — Number of backups to retain (default: 7)
- `BACKUP_DIR` — Directory for database backups (default: `backups/`)
- `PORT` — HTTP server port (default: 3000)
- `WEBAPP_URL` — Public URL of the web app (used in Telegram links)
- `WEBAPP_BOT_USERNAME` — Bot's @username on Telegram
- `CORS_ORIGIN` — Allowed CORS origin for frontend requests

Load from `.env.local` for local development (overrides `.env`).

## Client & Admin Workflows

**Client Flow (Lead Submission):**
1. User taps deep-link in Telegram (from_channel, quote_channel, support_channel, or catalog_channel)
2. Selects product from catalog (or enters quantity for quote)
3. Optionally adds comment or questions
4. Chooses contact method (phone, email, or Telegram DM)
5. Confirms submission → lead stored, admin receives notification

**Admin Workflow (Command-Based):**
- `/start` — Initialize admin session
- `/dialogs` — View recent client conversations
- `/clients` — List all clients and their contact info
- `/leads` — View pending leads and inquiry status
- `/setclient <name>` — Assign a client for manual handling
- `/stop` — End admin session

## Deployment Targets

- **Render** — Configured via `render.yaml` (Node.js service for bot, static site for web app)
- **Vercel** — Configured via `vercel.json` (serverless functions + static site)
- Both support environment variable injection at deployment time

## Key Implementation Notes

- The bot uses Telegraf's session middleware to maintain stateful conversations across message updates
- Database migrations are applied automatically on startup; add new schema changes to `src/db/migrations/` as SQL files
- CORS is strict by default; update `CORS_ORIGIN` if hosting frontend on a different domain than the API
- Backups run as a scheduled task; for production, consider external backup solutions (S3, database-as-a-service)
- The webapp is statically built and served; dynamic functionality relies on API calls to the Express backend
