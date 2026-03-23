# Docker Integration for Bot_noct

This document describes how to run the Bot_noct project using Docker containers.

## Overview

The project consists of:

- **Telegram Bot with Web Server** (Node.js/Express)
- **React Web Application** (Vite)
- **Render MCP Server** (Go)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- Environment variables configured in `.env` file

## Quick Start

### Development Mode

```bash
# Start all services in development mode
docker compose up

# Or start specific services
docker compose up bot-dev webapp
```

### Production Mode

```bash
# Start production services
docker compose up bot mcp-server

# Run in background
docker compose up -d bot mcp-server
```

## Service Details

### Bot Service (`bot`)

- **Dockerfile**: `Dockerfile` (multi-stage build)
- **Port**: 3000 (HTTP)
- **Environment**: Production
- **Features**:
  - Health check at `/healthz`
  - Persistent SQLite data via volume
  - Non-root user for security

### Development Bot Service (`bot-dev`)

- **Dockerfile**: `Dockerfile.dev`
- **Ports**: 3000 (HTTP), 9229 (Node.js debugger)
- **Features**:
  - Hot reload with `--watch`
  - Source code mounted for instant updates
  - Debugger enabled

### Webapp Service (`webapp`)

- **Dockerfile**: `Dockerfile.webapp`
- **Port**: 5173 (Vite dev server)
- **Features**:
  - React development server with hot module replacement
  - Proxy to bot service for API calls
  - Source code mounted

### MCP Server Service (`mcp-server`)

- **Location**: `render-mcp-server/`
- **Dockerfile**: `render-mcp-server/Dockerfile`
- **Port**: 8080
- **Purpose**: Render platform integration for deployment automation

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_telegram_admin_id

# Optional
PORT=3000
WEBAPP_URL=http://localhost:3000
CORS_ORIGIN=*
RENDER_API_TOKEN=your_render_token
RENDER_DEPLOY_HOOK_URL=your_deploy_hook_url
NODE_ENV=development
```

## Volumes

- `bot_data`: Persists SQLite database (`./data` directory)
- `webapp_node_modules`: Isolated node_modules for webapp service

## Networks

- `bot_noct_network`: Internal bridge network for service communication

## Health Checks

All services include health checks:

- Bot: `GET /healthz`
- MCP Server: TCP port check
- Webapp: TCP port check

## Common Commands

```bash
# View logs
docker compose logs -f bot
docker compose logs -f webapp

# Execute shell in container
docker compose exec bot sh
docker compose exec webapp sh

# Rebuild images
docker compose build --no-cache

# Stop and remove containers
docker compose down

# Remove volumes (data loss!)
docker compose down -v

# View running services
docker compose ps
```

## Production Deployment Tips

1. **Resource Limits**: Consider adding `deploy.resources` in docker-compose.yml for production
2. **Logging**: Configure log drivers for production environments
3. **Secrets**: Use Docker secrets or external secret management for sensitive data
4. **Updates**: Use `docker compose pull` followed by `docker compose up -d` for zero-downtime updates

## Troubleshooting

### Container fails to start

```bash
docker compose logs bot
```

### Database connection issues

```bash
docker compose exec bot ls -la /app/data/
```

### Port already in use

```bash
docker compose ps  # Check what's running
docker compose down  # Stop conflicting services
```

### Slow builds

- Ensure `.dockerignore` is properly configured
- Use buildkit: `DOCKER_BUILDKIT=1 docker compose build`
- Leverage cache mounts (already implemented in Dockerfiles)

## Security Notes

1. **Non-root user**: Services run as non-root user `appuser` (UID 1001)
2. **Read-only mounts**: Development mounts are read-only (`:ro`)
3. **Minimal images**: Uses distroless and alpine bases where possible
4. **No secrets in images**: Environment variables injected at runtime
5. **Health checks**: Enable automatic restart on failure

## MCP Server Specific

The MCP server has its own Dockerfile in `render-mcp-server/` directory. It's built separately and included in docker-compose for convenience.

To build MCP server independently:

```bash
cd render-mcp-server
docker build -t bot_noct_mcp .
```

## License

See [LICENSE](LICENSE) file for details.
