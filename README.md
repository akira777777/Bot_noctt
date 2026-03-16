# Bot_noct

Telegram bot on `Telegraf` for channel traffic, catalog browsing, lead intake, and admin conversations.

## Setup

1. Install dependencies:

```bash
npm install
npm test
npm run build:web
```

2. Copy `.env.example` to `.env` and fill in:

```env
NODE_ENV=development
BOT_TOKEN=your_bot_token
ADMIN_ID=your_telegram_id
DB_PATH=./data/bot.sqlite
BACKUP_RETENTION=50
BACKUP_DIR=./backups
PORT=3000
WEBAPP_URL=https://your-service.onrender.com
WEBAPP_BOT_USERNAME=your_bot_username
CORS_ORIGIN=https://your-miniapp.vercel.app
```

For production: set `NODE_ENV=production`, set `CORS_ORIGIN` to the Mini App origin (or comma-separated list). Optional: `DEBUG_INGEST_URL`, `DEBUG_SESSION_ID` — leave empty to disable debug ingest.

3. Start the bot:

```bash
npm start
```

`DEBUG_INGEST_URL` and `DEBUG_SESSION_ID` are optional. Leave them empty to disable debug ingest traffic completely.

## Channel Entry Payloads

Use deep links in posts, buttons, or pinned messages:

- Generic channel entry: `https://t.me/<bot_username>?start=from_channel`
- Lead-oriented entry: `https://t.me/<bot_username>?start=quote_channel`
- Support entry: `https://t.me/<bot_username>?start=support_channel`
- Catalog entry: `https://t.me/<bot_username>?start=catalog_channel`

## Client Flow

- Main actions:
  - `Оставить заявку`
  - `Каталог`
  - `Связаться с менеджером`
  - `Как оформить заказ`
- Lead flow:
  1. Choose product.
  2. Enter quantity.
  3. Add or skip comment.
  4. Choose contact method.
  5. Confirm lead.

The bot stores the source payload, chosen product, quantity, comment, and contact label before sending the lead to the admin.

## Admin Workflow

- `/start` shows admin commands.
- `/dialogs` opens a compact inbox of recent conversations.
- `/clients` shows recent active clients.
- `/leads` shows the latest leads with statuses.
- `/setclient <id>` manually selects a client if needed.
- `/stop` clears the current active dialog.

When a client writes:

- the bot logs the message into the conversation;
- the admin receives a card with source and message text;
- the admin can open the dialog from the inline button.

When a lead is created:

- the bot creates the lead and a system message inside the conversation;
- the admin receives a lead card;
- the admin can move it through `new`, `in_progress`, `called_back`, `awaiting_payment`, `fulfilled`, and `closed`.

## Persistence Notes

- SQLite is stored in `data/bot.sqlite`.
- Schema changes are applied through `src/db/migrations`.
- Multi-step lead flow state is stored in `sessions`.
- Conversation selection for the admin is stored in `admin_state`.

## Backup and Restore Check

- Optional backup settings:
  - `BACKUP_RETENTION` — how many latest backup sets to keep (default `50`).
  - `BACKUP_DIR` — where backup files are stored (default `backups`).

- Create SQLite backup:

```bash
npm run backup
```

- Verify that backup can be restored (checks `PRAGMA integrity_check` on latest backup):

```bash
npm run restore-check
```

- Verify specific backup file:

```bash
npm run restore-check -- backups/bot.sqlite.<timestamp>
```

## Manual Verification

Use `docs/manual-test-checklist.md` for a full manual QA pass.
