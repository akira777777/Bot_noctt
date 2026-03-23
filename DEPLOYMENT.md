# Deployment Guide

This project supports two deployment modes:

- Full mode: API + Telegram bot with `BOT_ENABLED=true`
- API-only mode: API/web runtime without Telegram with `BOT_ENABLED=false`

## Prerequisites

- Node.js 18+
- SQLite filesystem access
- Redis 6+ if you want external cache/queues
- Public HTTPS domain if you use Telegram webhooks

## 1. Configure Environment

Start from the template:

```bash
cp .env.example .env
```

Base runtime variables:

```env
NODE_ENV=production
BOT_ENABLED=true
PORT=3000
DB_PATH=./data/bot.sqlite
API_SECRET=replace_with_strong_secret
CORS_ORIGIN=https://your-web-domain.example
API_COMPRESSION=true
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=info
LOG_FORMAT=json
```

Telegram variables, only if `BOT_ENABLED=true`:

```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=123456789
TELEGRAM_DELIVERY_MODE=webhook
WEBHOOK_DOMAIN=https://your-public-domain.example
TELEGRAM_STARTUP_TIMEOUT_MS=15000
ALLOW_BOT_LAUNCH_FAILURE=false
```

## 2. Validate Configuration

```bash
npm run validate
```

`validate` now respects `BOT_ENABLED`. In API-only mode it skips Telegram-only requirements.

## 3. Start the Service

Local process:

```bash
npm start
```

API-only process:

```bash
BOT_ENABLED=false npm start
```

Docker Compose:

```bash
docker compose up -d
```

Production Compose profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml --profile prod up -d bot redis
```

## 4. Health and Smoke Checks

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/api/catalog
```

Recommended verification:

```bash
npm test
npm run smoke:api
npm run lint
npm run build:web
```

## 5. Telegram Delivery Modes

- `polling`: preferred for local development
- `webhook`: preferred for production with a stable HTTPS domain

If `TELEGRAM_DELIVERY_MODE=webhook` but `WEBHOOK_DOMAIN` is missing or placeholder-like, the runtime logs a warning and falls back to polling.

## 6. Operational Notes

- Admin HTTP routes fail closed without `API_SECRET` in production
- Legacy status `awaiting_payment` is normalized to `proposal_sent`
- Default catalog seeds are lawful sample items; existing user-created rows are preserved
- Queue and cache startup do not require Telegram secrets

## 7. Troubleshooting

Bot does not start:

```bash
curl -s https://api.telegram.org/bot${BOT_TOKEN}/getMe
```

API-only smoke:

```bash
BOT_ENABLED=false npm run smoke:api
```

Redis issues:

```bash
redis-cli ping
docker compose logs redis
```

Migrations and DB:

```bash
npm run backup
npm run restore-check
```
