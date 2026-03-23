const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { createApiRouter } = require("./routes/api");
const {
  createVerifyTelegramInitData,
} = require("./middleware/verify-telegram-init-data");
const { createRateLimiter } = require("./middleware/rate-limit");
const { logInfo, logError } = require("../utils/logger");

function createWebServer({
  repos,
  botToken,
  adminId,
  corsOrigin,
  isProduction,
}) {
  const app = express();
  app.set("trust proxy", 1);
  const webappDistPath = path.join(process.cwd(), "webapp", "dist");
  const hasBuiltFrontend = fs.existsSync(
    path.join(webappDistPath, "index.html"),
  );

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
  app.use((req, res, next) => {
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://telegram.org",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.telegram.org",
        "frame-ancestors 'none'",
      ].join("; "),
    );
    next();
  });

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

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "bot_noct_web" });
  });

  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: "Слишком много запросов. Повторите попытку позже.",
  });

  const verifyTelegramInitData = createVerifyTelegramInitData({
    botToken,
    adminId,
  });
  app.use(
    "/api",
    apiRateLimiter,
    verifyTelegramInitData,
    createApiRouter({ repos }),
  );

  if (hasBuiltFrontend) {
    app.use(express.static(webappDistPath));
    app.get("/{*path}", (req, res, next) => {
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

module.exports = {
  createWebServer,
};
