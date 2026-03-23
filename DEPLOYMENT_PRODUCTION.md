# Production Deployment Guide

## Prerequisites

1. **Node.js 20+** installed
2. **Redis** server running (for caching and queues)
3. **PostgreSQL** (optional, for high-traffic production)
4. **PM2** for process management (optional)
5. **Domain** with SSL certificate for webhook mode

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd Bot_noct
npm install
```

### 2. Configure Environment

Copy production template and fill in your values:

```bash
cp .env.production .env
```

**Required values to fill:**

- `BOT_TOKEN` - Get from [@BotFather](https://t.me/BotFather)
- `ADMIN_ID` - Your Telegram user ID
- `REDIS_HOST` / `REDIS_PASSWORD` / `REDIS_DB` - Your Redis instance
- `API_SECRET` - Generate secure random string
- `WEBHOOK_DOMAIN` - Public HTTPS base URL of the deployed app

### 3. Setup Redis

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or use managed Redis (Redis Cloud, Upstash, etc.)
```

### 4. Start with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start production
npm run pm2:start

# Check logs
npm run pm2:logs

# Monitor
npm run pm2:monit
```

### 5. Setup Systemd (Optional)

For auto-restart on server reboot:

```bash
sudo nano /etc/systemd/system/bot-noct.service
```

```ini
[Unit]
Description=Bot Noct Telegram Service
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

```bash
sudo systemctl enable bot-noct
sudo systemctl start bot-noct
```

## Docker Deployment

### Build and Run

```bash
# Build image
docker build --target production -t bot-noct .

# Run production stack
docker compose -f docker-compose.yml -f docker-compose.production.yml --profile prod up -d bot redis
```

### Docker Compose (Recommended)

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml --profile prod up -d bot redis
```

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3000/healthz
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-03-23T12:00:00.000Z",
  "uptime": 12.3,
  "service": "telegram-bot"
}
```

## Monitoring

### PM2 Metrics

```bash
pm2 monit          # Real-time monitoring
pm2 list          # List all processes
pm2 info bot-noct  # Detailed info
```

### Logs

```bash
# Application logs
tail -f logs/application.log

# PM2 logs
pm2 logs bot-noct --lines 100
```

## Troubleshooting

### Bot Not Responding

1. Check bot token is correct
2. Verify Redis connection
3. Check logs for errors

```bash
pm2 logs bot-noct --err --lines 50
```

### Memory Issues

If experiencing memory problems:

```bash
# Check memory usage
pm2 list

# Restart with fresh memory
pm2 restart bot-noct
```

### Database Locked

```bash
# For SQLite, check file permissions
chmod 666 data/bot.sqlite
```

## Security Checklist

- [ ] Change default `API_SECRET`
- [ ] Use strong Redis password
- [ ] Enable SSL on web server
- [ ] Use environment variables for secrets
- [ ] Regular backups enabled

## Backup Strategy

```bash
# Manual backup
npm run backup

# Automated (add to crontab)
0 2 * * * /opt/Bot_noct/scripts/backup-sqlite.js
```

## Performance Tuning

### Recommended Settings

```env
TELEGRAM_DELIVERY_MODE=webhook
MEMORY_LIMIT_WARN=512
MEMORY_LIMIT_CRITICAL=768
```
