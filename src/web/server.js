const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { createApiRouter } = require("./routes/api");
const {
  createVerifyTelegramInitData,
} = require("./middleware/verify-telegram-init-data");

function createWebServer({
  repos,
  botToken,
  adminId,
  corsOrigin,
  isProduction,
}) {
  const app = express();
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
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  if (!isProduction) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        // eslint-disable-next-line no-console
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
        );
      });
      next();
    });
  }

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "bot_noct_web" });
  });

  const verifyTelegramInitData = createVerifyTelegramInitData({
    botToken,
    adminId,
  });
  app.use(
    "/api",
    verifyTelegramInitData,
    createApiRouter({ repos, isProduction }),
  );

  // Middleware to protect mini app - only admins can access
  const protectMiniApp = (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const bearer = authorization.startsWith("tma ")
      ? authorization.slice(4)
      : null;
    const initData = bearer || req.headers["x-telegram-init-data"];

    // Allow static assets (CSS, JS, etc.) to load
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

  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = isProduction ? "Internal server error" : err.message;
    if (!res.headersSent) {
      res.status(status).json({ ok: false, error: message });
    }
  });

  return app;
}

module.exports = {
  createWebServer,
};
