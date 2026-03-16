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

  const corsOrigin = process.env.CORS_ORIGIN;
  app.use(
    cors(
      corsOrigin
        ? { origin: corsOrigin.split(",").map((s) => s.trim()), credentials: true }
        : undefined,
    ),
  );
  app.use(express.json({ limit: "1mb" }));

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
