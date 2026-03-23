# Deployment Guide - Bot_noct

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Local Development](#local-development)
4. [Docker Deployment](#docker-deployment)
5. [Production Deployment](#production-deployment)
6. [Database Setup](#database-setup)
7. [Redis Setup](#redis-setup)
8. [Health Checks](#health-checks)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ (LTS recommended)
- Docker & Docker Compose
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Redis 6+ (for caching and queues)

---

## Environment Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Configure the required variables:

```env
# Telegram Configuration
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_telegram_user_id

# Database
DB_PATH=./data/bot.sqlite

# Redis (Cache & Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Application
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.com
```

---

## Local Development

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Option 2: Manual Development

```bash
# Install dependencies
npm install

# Start Redis locally
docker run -d -p 6379:6379 redis:alpine

# Run with hot reload
npm run dev

# Or run normally
npm start
```

---

## Docker Deployment

### Build Image

```bash
# Build production image
docker build -t bot-noct:latest --target production .

# Or using docker compose
docker compose build bot
```

### Run Container

```bash
# Run bot service
docker compose up -d bot

# Run with Redis
docker compose up -d bot redis

# View logs
docker compose logs -f bot

# Scale (for production)
docker compose up -d --scale bot=3
```

### Environment Variables for Docker

```yaml
# docker-compose.yml service configuration
environment:
  - NODE_ENV=production
  - BOT_TOKEN=${BOT_TOKEN}
  - ADMIN_ID=${ADMIN_ID}
  - REDIS_HOST=redis
  - REDIS_PORT=6379
  - LOG_LEVEL=info
  - LOG_FORMAT=json
```

---

## Production Deployment

### Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bot-noct
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bot-noct
  template:
    metadata:
      labels:
        app: bot-noct
    spec:
      containers:
        - name: bot
          image: bot-noct:latest
          ports:
            - containerPort: 3000
          env:
            - name: BOT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: bot-secrets
                  key: token
            - name: REDIS_HOST
              value: "redis-service"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /readyz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

### Render.com

The project includes `render.yaml` for Render.com deployment:

```bash
# Deploy using CLI
render deploy --config render.yaml

# Or use the provided GitHub integration
```

---

## Database Setup

### SQLite (Development/Default)

Data is stored in `./data/bot.sqlite` and automatically created on first run.

```bash
# Create data directory
mkdir -p data

# Set permissions
chmod 755 data
```

### PostgreSQL (Production)

```env
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=bot_noct
DB_USER=postgres
DB_PASSWORD=your-password
DB_SSL=true
```

### Database Migrations

Migrations run automatically on startup. Manual migration:

```bash
npm run migrate
```

---

## Redis Setup

### Local Installation

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### Docker Redis

```bash
# Run Redis container
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:alpine \
  redis-server --appendonly yes --maxmemory 256mb
```

### Redis Configuration

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # Optional
REDIS_DB=0

# Memory limits
CACHE_TTL_SESSION=3600      # 1 hour
CACHE_TTL_CATALOG=300      # 5 minutes
CACHE_TTL_STATS=60         # 1 minute
```

---

## Health Checks

The bot exposes health check endpoints for container orchestration:

| Endpoint   | Purpose   | Description                           |
| ---------- | --------- | ------------------------------------- |
| `/healthz` | Liveness  | Basic check if service is running     |
| `/readyz`  | Readiness | Checks DB, cache, memory availability |
| `/livez`   | Liveness  | Simple alive check                    |
| `/health`  | Detailed  | Full system metrics and status        |

### Example Health Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "status": "ok" },
    "cache": { "status": "ok", "mode": "redis" },
    "memory": { "status": "ok", "used": { "heapUsed": 120 } }
  },
  "system": {
    "totalMemory": 8192,
    "freeMemory": 4096,
    "cpuCount": 4,
    "loadAverage": [1.5, 1.2, 1.0]
  }
}
```

---

## Monitoring

### Metrics Endpoint

For Prometheus-style monitoring:

```bash
# Get metrics
curl http://localhost:3000/metrics
```

### Queue Statistics

```bash
# Get queue stats (admin only)
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/admin/queues
```

### Cache Statistics

```bash
# Get cache stats (admin only)
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/admin/cache
```

---

## Troubleshooting

### Bot Not Starting

1. Check Telegram token validity:

```bash
curl -s https://api.telegram.org/bot${BOT_TOKEN}/getMe
```

2. Verify environment variables:

```bash
docker compose exec bot env | grep -E "BOT_|ADMIN_|REDIS"
```

### Database Errors

1. Check SQLite file permissions:

```bash
ls -la data/
chmod 644 data/bot.sqlite
```

2. Verify migrations:

```bash
docker compose logs bot | grep migration
```

### Redis Connection Issues

1. Test Redis connection:

```bash
redis-cli ping
docker compose exec redis redis-cli ping
```

2. Check Redis logs:

```bash
docker compose logs redis
```

### Memory Issues

1. Check memory usage:

```bash
curl http://localhost:3000/debug/memory
```

2. Adjust memory limits in docker-compose.yml

### Queue Processing Issues

1. Check queue status:

```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3000/api/admin/queues
```

2. View queue logs:

```bash
docker compose logs bot | grep queue
```

---

## Security Checklist

- [ ] Change default `API_SECRET`
- [ ] Set strong `REDIS_PASSWORD`
- [ ] Configure `CORS_ORIGIN` for specific domains
- [ ] Enable `LOG_FORMAT=json` in production
- [ ] Set `LOG_LEVEL=warn` in production
- [ ] Use TLS/SSL for production URLs
- [ ] Enable Redis authentication
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring alerts

---

## Performance Tuning

### Memory Limits

```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
    reservations:
      memory: 512M
```

### Cache TTL Optimization

```env
CACHE_TTL_SESSION=3600    # Increase for stable sessions
CACHE_TTL_CATALOG=600    # Decrease for frequently changing catalog
```

### Queue Concurrency

```env
QUEUE_CONCURRENCY_MESSAGES=10
QUEUE_CONCURRENCY_WEBHOOKS=5
QUEUE_CONCURRENCY_BATCH=2
```

---

## Backup & Recovery

### Database Backup

```bash
# SQLite backup
cp data/bot.sqlite data/bot.sqlite.backup

# Automated backup script
./scripts/backup-sqlite.js
```

### Redis Backup

```bash
# Redis persistence handles this automatically
# RDB and AOF files are in data/redis/
```

---

## Support

For issues and questions:

1. Check logs: `docker compose logs bot`
2. Review health status: `curl http://localhost:3000/health`
3. Consult the [main README](README.md)
