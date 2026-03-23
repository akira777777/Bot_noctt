/**
 * Enhanced Web Server with graceful shutdown, timeouts, and rate limiting
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createApiRouter } = require("./routes/api");
const {
  createVerifyTelegramInitData,
} = require("./middleware/verify-telegram-init-data");
const { logError, logInfo, logDebug } = require("../utils/logger");

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.clients = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
  }

  getKey(req) {
    // Use IP address as key, with fallback
    return req.ip || req.connection?.remoteAddress || "unknown";
  }

  isAllowed(key) {
    const now = Date.now();
    const client = this.clients.get(key);

    if (!client) {
      this.clients.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + this.windowMs;
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (client.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: client.resetTime,
      };
    }

    client.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - client.count,
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, client] of this.clients.entries()) {
      if (now > client.resetTime) {
        this.clients.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const result = this.isAllowed(key);

      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", this.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));

      if (result.resetTime) {
        res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000));
      }

      if (!result.allowed) {
        logDebug(`Rate limit exceeded for ${key}`);
        return res.status(429).json({
          ok: false,
          error: "Too many requests",
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      next();
    };
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Request timeout middleware
 */
function timeoutMiddleware(timeoutMs = 30000) {
  return (req, res, next) => {
    // Set timeout for this request
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logError(`Request timeout: ${req.method} ${req.originalUrl}`);
        res.status(408).json({
          ok: false,
          error: "Request timeout",
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on("finish", () => clearTimeout(timeout));
    res.on("close", () => clearTimeout(timeout));

    next();
  };
}

/**
 * Graceful shutdown handler
 */
class GracefulShutdown {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      timeoutMs: options.timeoutMs || 30000,
      beforeShutdown: options.beforeShutdown || (async () => {}),
      afterShutdown: options.afterShutdown || (async () => {}),
    };
    this.isShuttingDown = false;
    this.connections = new Set();
  }

  attach() {
    // Track connections
    this.server.on("connection", (conn) => {
      this.connections.add(conn);
      conn.on("close", () => this.connections.delete(conn));
    });

    // Handle shutdown signals
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
    process.on("SIGINT", () => this.shutdown("SIGINT"));
  }

  async shutdown(signal) {
    if (this.isShuttingDown) {
      logInfo("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    logInfo(`Received ${signal}, starting graceful shutdown...`);

    const startTime = Date.now();

    try {
      // Run pre-shutdown hooks
      await this.options.beforeShutdown();

      // Stop accepting new connections
      this.server.close(() => {
        logInfo("HTTP server closed, no longer accepting connections");
      });

      // Wait for existing connections to close
      const timeoutMs = this.options.timeoutMs;
      while (this.connections.size > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          logError(
            `Shutdown timeout reached with ${this.connections.size} active connections`,
          );
          break;
        }

        logDebug(
          `Waiting for ${this.connections.size} connections to close...`,
        );
        await this.delay(100);
      }

      // Force close remaining connections
      for (const conn of this.connections) {
        conn.destroy();
      }

      // Run post-shutdown hooks
      await this.options.afterShutdown();

      const totalTime = Date.now() - startTime;
      logInfo(`Graceful shutdown completed in ${totalTime}ms`);

      process.exit(0);
    } catch (error) {
      logError("Error during shutdown", error);
      process.exit(1);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create enhanced web server
 */
function createEnhancedWebServer({
  repos,
  dbManager,
  botToken,
  adminId,
  corsOrigin,
  isProduction,
  requestTimeoutMs = 30000,
  rateLimitWindowMs = 60000,
  rateLimitMaxRequests = 100,
}) {
  const app = express();
  const webappDistPath = path.join(process.cwd(), "webapp", "dist");
  const hasBuiltFrontend = fs.existsSync(
    path.join(webappDistPath, "index.html"),
  );

  // Trust proxy for accurate IP behind reverse proxy
  app.set("trust proxy", 1);

  // Compression (gzip)
  app.use(compression());

  // Security headers (frameguard disabled for Telegram Mini App iframe)
  app.use(
    helmet({
      frameguard: false,
    }),
  );

  // CORS
  app.use(
    cors(
      corsOrigin
        ? {
            origin: corsOrigin.split(",").map((s) => s.trim()),
            credentials: true,
          }
        : undefined,
    ),
  );

  // Body parsing with limits
  app.use(
    express.json({
      limit: "1mb",
      strict: true,
    }),
  );

  // Rate limiting
  const rateLimiter = new RateLimiter({
    windowMs: rateLimitWindowMs,
    maxRequests: rateLimitMaxRequests,
  });
  app.use(rateLimiter.middleware());

  // Request timeout
  app.use(timeoutMiddleware(requestTimeoutMs));

  // Request logging (non-production)
  if (!isProduction) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        logDebug(
          `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
        );
      });
      next();
    });
  }

  // Health check with DB status
  app.get("/healthz", (_req, res) => {
    const dbHealth = dbManager?.getHealth() || { isHealthy: false };

    if (!dbHealth.isHealthy) {
      return res.status(503).json({
        ok: false,
        service: "bot_noct_web",
        status: "unhealthy",
        database: dbHealth,
      });
    }

    res.json({
      ok: true,
      service: "bot_noct_web",
      status: "healthy",
      database: dbHealth,
    });
  });

  // API routes with Telegram auth
  const verifyTelegramInitData = createVerifyTelegramInitData({
    botToken,
    adminId,
  });
  app.use(
    "/api",
    verifyTelegramInitData,
    createApiRouter({ repos, isProduction }),
  );

  // Mini app protection middleware
  const protectMiniApp = (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const bearer = authorization.startsWith("tma ")
      ? authorization.slice(4)
      : null;
    const initData = bearer || req.headers["x-telegram-init-data"];

    // Allow static assets
    if (
      req.path.startsWith("/assets/") ||
      req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
    ) {
      return next();
    }

    // For HTML pages, check admin access
    if (req.accepts("html")) {
      if (!initData) {
        return res.status(403).send(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Доступ запрещён</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; }
    h1 { color: #333; margin-top: 0; }
    p { color: #666; line-height: 1.6; }
    .icon { font-size: 64px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Доступ запрещён</h1>
    <p>Мини-приложение доступно только администраторам.</p>
    <p>Пожалуйста, откройте его через меню бота в Telegram.</p>
  </div>
</body>
</html>`,
        );
      }
    }

    return next();
  };

  // Static files
  if (hasBuiltFrontend) {
    app.use(protectMiniApp);
    app.use(express.static(webappDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      return res.sendFile(path.join(webappDistPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send("Mini App frontend is not built yet. Run: npm run build:web");
    });
  }

  // Global error handler
  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = isProduction ? "Internal server error" : err.message;

    logError(`Request error: ${status}`, err);

    if (!res.headersSent) {
      res.status(status).json({ ok: false, error: message });
    }
  });

  return {
    app,
    rateLimiter,
  };
}

/**
 * Start server with graceful shutdown support
 */
async function startServer(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logInfo(`Server listening on port ${port}`);
      resolve(server);
    });

    server.once("error", reject);
  });
}

module.exports = {
  createEnhancedWebServer,
  startServer,
  GracefulShutdown,
  RateLimiter,
  timeoutMiddleware,
};
