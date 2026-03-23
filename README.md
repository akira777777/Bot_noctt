# Bot_noct

Telegram bot (`Telegraf`) for catalog browsing, lead intake, and admin conversations, plus a web admin/dashboard (`Next.js`) for lead management.

## Quickstart

1. Install dependencies:

```bash
npm install
npm install --prefix web
```

1. Configure environment:

Copy `.env.example` to `.env.local` and set at least `BOT_TOKEN` and `ADMIN_ID`.

```env
NODE_ENV=development
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=123456789
DB_PATH=./data/bot.sqlite
BACKUP_RETENTION=50
BACKUP_DIR=./backups
PORT=3081

# API security (admin endpoints)
API_SECRET=your_random_api_secret_key
CORS_ORIGIN=https://your-dashboard.vercel.app
WEB_APP_URL=https://your-dashboard.vercel.app/mini-app

# Webhook mode (optional; polling is used if not set)
WEBHOOK_DOMAIN=https://your-service.onrender.com
```

1. Start the bot + API server:

```bash
npm start
```

If you also want the web dashboard (Next.js):

```bash
npm run dev:web
```

## Web API

Health:

- `GET /healthz` -> `{ ok: true }`

Public (no API key):

- `GET /api/catalog` — list active products
- `GET /api/lead/:id/status` — public lead status (no PII)
- `POST /api/lead` — create a lead from the web form

Admin (requires header `X-Api-Key` when `API_SECRET` is set):

- `GET /api/admin/leads`
- `GET /api/admin/leads/:id`
- `PATCH /api/admin/leads/:id/status`
- `GET /api/admin/conversations`
- `GET /api/admin/conversations/:clientId/messages`
- `POST /api/admin/conversations/:clientId/reply`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `PATCH /api/admin/products/:id/toggle`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/block`
- `GET /api/admin/stats`
- `GET /api/admin/stats/daily?days=30`
- `GET /api/admin/export/leads`

`X-Api-Key` is set automatically by `web/lib/api.ts` when using admin functions.

## Telegram flows

### Channel entry payloads

Use deep links in posts, buttons, or pinned messages:

- `...?start=from_channel`
- `...?start=quote_channel`
- `...?start=support_channel`
- `...?start=catalog_channel`

### Lead flow (client)

1. Choose product
2. Enter quantity
3. Add or skip comment
4. Choose contact method
5. Confirm lead

### Admin workflow (commands)

- `/start`
- `/dialogs`
- `/clients`
- `/leads`
- `/setclient <id>`
- `/stop`

Client mini app command:

- `/app`

If `WEB_APP_URL` is configured, the bot also shows the `📱 Открыть мини-приложение` button in the home keyboard.

## Deploy web (Mini App)

The Telegram mini app route is `web/app/mini-app/page.tsx`, exposed as `/mini-app`.

1. Deploy `web/` to a public HTTPS host (for example, Vercel).
2. Set web environment variables:
   - `API_URL` -> your public bot/API URL (for example Render)
   - `BOT_TOKEN`, `ADMIN_ID`, `JWT_SECRET` -> for Telegram admin auth in Next.js routes
3. Set bot environment variable:
   - `WEB_APP_URL=https://<your-web-domain>/mini-app`
4. Restart bot service. `/app` and the menu button will open the mini app in Telegram.

## Database & migrations

- SQLite is stored in `DB_PATH` (default `data/bot.sqlite`)
- Migrations live in `src/db/migrations` and are applied on startup
- If `products` is empty, default products are seeded automatically

## Backups

- Create SQLite backup:

```bash
npm run backup
```

- Verify backup integrity (uses latest backup by default, `PRAGMA integrity_check`):

```bash
npm run restore-check
```

- Verify a specific backup file:

```bash
npm run restore-check -- backups/bot.sqlite.<timestamp>
```

## Manual verification

Use `docs/manual-test-checklist.md` for a full manual QA pass.
