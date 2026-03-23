# Bot_noct — Project Context for AI Assistants

## Overview

Telegram support bot for channel traffic, catalog browsing, lead intake, and admin conversations. Deployed on Render (web service + persistent disk).

## Stack

| Layer | Tech |
|-------|------|
| Bot | Telegraf 4.x |
| Web | Express 4.x |
| Frontend | React 18 + Vite 5 |
| Database | SQLite (better-sqlite3) |
| Deployment | Render |

## Structure

```
├── index.js              # Entry point
├── src/
│   ├── bot.js            # Telegraf bot setup
│   ├── config/env.js     # Environment config
│   ├── db/               # SQLite, migrations, connection
│   ├── domain/           # Lead status, shared logic
│   ├── handlers/         # client.js, admin.js
│   ├── repositories/     # Data access
│   ├── services/         # lead, catalog, admin, conversation
│   ├── ui/               # keyboards, messages, catalog-view
│   ├── utils/            # logger, telegram, formatters, debug-ingest
│   └── web/              # Express server, routes, middleware
├── webapp/               # React Mini App (Vite)
├── data/bot.sqlite       # SQLite database
└── scripts/              # backup, restore-check
```

## Conventions

- **CommonJS** — `require`/`module.exports`; no ESM
- **SQLite path** — `data/bot.sqlite` (relative to project root)
- **Migrations** — `src/db/migrations/`; run via `migrations/index.js`
- **Env vars** — `BOT_TOKEN`, `ADMIN_ID`, `PORT`, `WEBAPP_URL`, `CORS_ORIGIN`; see `.env.example`

## MCP Servers (`.cursor/mcp.json`)

| Server | Purpose |
|--------|---------|
| filesystem | File read/write in project root |
| sqlite | Query `data/bot.sqlite` |
| fetch | Fetch web content to markdown |
| memory | Persistent AI context |

Restart Cursor after editing `.cursor/mcp.json` to load MCP servers.

## Caveats

- **Mini App iframe** — The Mini App runs in a Telegram iframe. `X-Frame-Options: SAMEORIGIN` can block it. If adding helmet, use `frameguard: false` or a CSP that allows Telegram framing.
- **Existing security** — `src/web/enhanced-server.js` uses helmet (frameguard disabled for Mini App), compression, rate limiting, and graceful shutdown.
- **Debug ingest** — Optional `DEBUG_INGEST_URL` and `DEBUG_SESSION_ID`; leave empty to disable.

## Scripts

- `npm start` — Run bot
- `npm test` — Node test runner
- `npm run build:web` — Build Mini App
- `npm run backup` — SQLite backup
- `npm run restore-check` — Verify backup integrity
