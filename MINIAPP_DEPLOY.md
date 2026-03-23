# Bot Noct Mini App Deploy (Render)

## 1) Create Render service

- Push this repository to GitHub.
- In Render: **New +** -> **Blueprint**.
- Select the repository and apply `render.yaml`.

## 2) Set required environment variables

- `BOT_TOKEN` - Telegram bot token
- `ADMIN_ID` - Telegram ID of admin
- `WEBAPP_BOT_USERNAME` - bot username without `@` (optional)

`DB_PATH` and `PORT` are already set in `render.yaml`.

## 3) Build and start

Render will run:

- Build: `npm install && npm run build:web`
- Start: `npm start`

## 4) Stable Mini App URL

The app automatically uses `RENDER_EXTERNAL_URL` as `WEBAPP_URL` if `WEBAPP_URL` is not set.
This gives a stable HTTPS address from Render and avoids `*.trycloudflare.com`.

## 5) Telegram check

- Open bot `/start` as admin.
- Press **Открыть Mini App админки**.
- Verify tabs:
  - Leads
  - Products
  - Users
  - Stats

## 6) Post-deploy verification

- Run API smoke locally (or in a debug shell with env vars):
  - `npm run smoke:api`
- Follow the operational checklist in:
  - `docs/runbook.md`
