# Production Deployment Guide

Use this document for a production deployment with Telegram enabled.

## Required Inputs

- `BOT_ENABLED=true`
- valid `BOT_TOKEN`
- valid numeric `ADMIN_ID`
- `API_SECRET`
- `DB_PATH`
- Redis connection details if you use cache/queues
- public HTTPS `WEBHOOK_DOMAIN` when `TELEGRAM_DELIVERY_MODE=webhook`

## Recommended Production Settings

```env
NODE_ENV=production
BOT_ENABLED=true
PORT=3000
DB_PATH=./data/bot.sqlite
API_SECRET=replace_with_strong_secret
CORS_ORIGIN=https://your-web-domain.example
BOT_TOKEN=replace_me
ADMIN_ID=123456789
TELEGRAM_DELIVERY_MODE=webhook
WEBHOOK_DOMAIN=https://your-app-domain.example
TELEGRAM_STARTUP_TIMEOUT_MS=15000
ALLOW_BOT_LAUNCH_FAILURE=false
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=info
LOG_FORMAT=json
MEMORY_LIMIT_WARN=512
MEMORY_LIMIT_CRITICAL=768
```

## Deployment Flow

1. Install dependencies.
2. Copy `.env.production` to `.env` and fill real values.
3. Run `npm run validate`.
4. Run local verification:
   - `npm test`
   - `npm run smoke:api`
   - `npm run build:web`
5. Deploy with your process manager or container platform.
6. Verify:
   - `GET /healthz`
   - `GET /api/catalog`
   - Telegram `/start`
   - one full request flow through `proposal_sent`

## PM2 Example

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 logs bot-noct --lines 100
pm2 monit
```

## Systemd Example

```ini
[Unit]
Description=Bot Noct Inquiry Service
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/Bot_noct
ExecStart=/usr/bin/node /opt/Bot_noct/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Rollback Notes

- Roll back the application artifact or container first.
- If needed, restore SQLite from a verified backup:
  - `npm run backup`
  - `npm run restore-check`
- Re-check `/healthz`, `/api/catalog`, and Telegram request creation after rollback.

## Operational Expectations

- Health endpoints stay available even when Telegram runtime is disabled or degraded
- Admin API remains protected by `API_SECRET`
- Request status vocabulary is `new`, `in_progress`, `called_back`, `proposal_sent`, `fulfilled`, `closed`
- Legacy `awaiting_payment` inputs remain accepted and are normalized internally
