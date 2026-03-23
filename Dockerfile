# =============================================================================
# Bot_noct - Telegram Bot with Web Server
# Multi-stage build for production optimization
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

# -----------------------------------------------------------------------------
# Stage 2: Development dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS dev-deps

RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./

RUN npm ci

# -----------------------------------------------------------------------------
# Stage 4: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies for native modules (better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=appuser:appgroup . .


# Create data directory for SQLite
RUN mkdir -p data && chown appuser:appgroup data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Start application
CMD ["node", "index.js"]
