const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { createPublicRoutes } = require("./routes/public");
const { createAdminRoutes } = require("./routes/admin");
const { createApiKeyAuth } = require("./middleware/api-key-auth");
const { createRateLimiter } = require("./middleware/rate-limit");
const { logInfo, logError } = require("../utils/logger");

function createWebServer({
  repos,
  conversationService,
  bot,
  adminId,
  apiSecret,
  corsOrigin,
  isProduction,
}) {
  const app = express();
  app.set("trust proxy", 1);

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
  app.use(express.json({ limit: "1mb" }));

  // Request ID
  app.use((req, res, next) => {
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logInfo("http_request", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip,
      });
    });
    next();
  });

  // Health check
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "bot_noct_api" });
  });

  // Public API (rate limited)
  const publicLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: "Слишком много запросов.",
  });
  app.use("/api", publicLimiter, createPublicRoutes({ repos, bot, adminId }));

  // Admin API (API key auth + rate limited)
  const adminLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: "Слишком много запросов.",
  });
  const apiKeyAuth = createApiKeyAuth({ apiSecret });
  app.use(
    "/api/admin",
    adminLimiter,
    apiKeyAuth,
    createAdminRoutes({ repos, conversationService, adminId }),
  );

  // Error handler
  app.use((err, req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = isProduction ? "Internal server error" : err.message;
    logError("unhandled_http_error", err, { requestId: req.requestId, status });
    if (!res.headersSent) {
      res.status(status).json({ ok: false, error: message });
    }
  });

  return app;
}

module.exports = { createWebServer };
