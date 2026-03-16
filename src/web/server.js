const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { createApiRouter } = require("./routes/api");
const {
  createVerifyTelegramInitData,
} = require("./middleware/verify-telegram-init-data");

function createWebServer({ repos, botToken, adminId }) {
  const app = express();
  const webappDistPath = path.join(process.cwd(), "webapp", "dist");
  const hasBuiltFrontend = fs.existsSync(
    path.join(webappDistPath, "index.html"),
  );

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use((req, _res, next) => {
    if (!req.path.startsWith("/api")) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "9080fe",
          },
          body: JSON.stringify({
            sessionId: "9080fe",
            runId: "post-fix",
            hypothesisId: "H8_WEBAPP_REQUEST_PATH",
            location: "src/web/server.js:app.use(requestProbe)",
            message: "Incoming non-API web request",
            data: {
              method: req.method,
              path: req.path,
              originalUrl: req.originalUrl,
              host: req.headers.host || null,
              userAgent: req.headers["user-agent"] || null,
              referer: req.headers.referer || null,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
    }
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "bot_noct_web" });
  });

  const verifyTelegramInitData = createVerifyTelegramInitData({
    botToken,
    adminId,
  });
  app.use("/api", verifyTelegramInitData, createApiRouter({ repos }));

  if (hasBuiltFrontend) {
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

  return app;
}

module.exports = {
  createWebServer,
};
