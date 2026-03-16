const path = require("path");
const dotenv = require("dotenv");
const { createDebugIngest } = require("../utils/debug-ingest");

dotenv.config();

const DEBUG_INGEST_URL = process.env.DEBUG_INGEST_URL || null;
const DEBUG_SESSION_ID = process.env.DEBUG_SESSION_ID || null;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;
const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "bot.sqlite");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const WEBAPP_URL =
  process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || null;
const WEBAPP_BOT_USERNAME = process.env.WEBAPP_BOT_USERNAME || null;

// #region agent log
fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "9080fe",
  },
  body: JSON.stringify({
    sessionId: "9080fe",
    runId: "pre-fix",
    hypothesisId: "H1_WEBAPP_URL_SOURCE",
    location: "src/config/env.js:16",
    message: "Resolved WEBAPP_URL from environment",
    data: {
      webappUrl: WEBAPP_URL,
      webappHost: (() => {
        if (!WEBAPP_URL) {
          return null;
        }
        try {
          return new URL(WEBAPP_URL).host;
        } catch (_) {
          return "invalid-url";
        }
      })(),
      hasExplicitWebappUrl: Boolean(process.env.WEBAPP_URL),
      hasRenderExternalUrl: Boolean(process.env.RENDER_EXTERNAL_URL),
    },
    timestamp: Date.now(),
  }),
})
  .then(() => {
    console.log("[DBG9080fe] ingest probe sent");
  })
  .catch((error) => {
    console.log(
      "[DBG9080fe] ingest probe failed",
      error?.message || String(error),
    );
  });
// #endregion

const debugIngest = createDebugIngest({
  url: DEBUG_INGEST_URL,
  sessionId: DEBUG_SESSION_ID,
});

void debugIngest({
  runId: "startup",
  hypothesisId: "ENV",
  location: "src/config/env.js:module-load",
  message: "Environment module loaded",
  data: {
    cwd: process.cwd(),
    hasBotToken: Boolean(BOT_TOKEN),
    hasAdminId: Boolean(process.env.ADMIN_ID),
  },
});

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set in environment variables");
}

if (!ADMIN_ID || Number.isNaN(ADMIN_ID)) {
  throw new Error("ADMIN_ID is not set or invalid in environment variables");
}

if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error("PORT is invalid in environment variables");
}

module.exports = {
  BOT_TOKEN,
  ADMIN_ID,
  DB_PATH,
  PORT,
  WEBAPP_URL,
  WEBAPP_BOT_USERNAME,
  DEBUG_INGEST_URL,
  DEBUG_SESSION_ID,
};
