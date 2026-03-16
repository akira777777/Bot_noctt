const { createDatabase } = require("./src/db/sqlite");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const {
  BOT_TOKEN,
  ADMIN_ID,
  PORT,
  WEBAPP_URL,
  DEBUG_INGEST_URL,
  DEBUG_SESSION_ID,
} = require("./src/config/env");
const { createWebServer } = require("./src/web/server");
const { logError, logInfo } = require("./src/utils/logger");
const { createDebugIngest } = require("./src/utils/debug-ingest");

const debugIngest = createDebugIngest({
  url: DEBUG_INGEST_URL,
  sessionId: DEBUG_SESSION_ID,
});

let appResources = null;
let isShuttingDown = false;

function startHttpServer(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

function closeHttpServer(server) {
  if (!server || !server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function stopBot(bot, signal) {
  if (!bot) {
    return;
  }

  try {
    bot.stop(signal);
  } catch (error) {
    if (/bot is not running/i.test(error?.message || "")) {
      return;
    }
    logError(`Failed to stop bot during ${signal}`, error);
  }
}

function closeDatabase(db) {
  if (!db) {
    return;
  }

  try {
    db.close();
  } catch (error) {
    logError("Failed to close database", error);
  }
}

async function teardown(resources, reason) {
  if (!resources) {
    return;
  }

  // #region agent log
  fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "8930e6",
    },
    body: JSON.stringify({
      sessionId: "8930e6",
      runId: "pre-fix",
      hypothesisId: "H1_BOOTSTRAP_TEARDOWN_PATH",
      location: "index.js:teardown",
      message: "Teardown invoked",
      data: {
        reason,
        hasResources: Boolean(resources),
        botLaunched: Boolean(resources.botLaunched),
        hasHttpServer: Boolean(resources.httpServer),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (resources.botLaunched) {
    stopBot(resources.bot, reason);
  }

  if (resources.httpServer) {
    try {
      await closeHttpServer(resources.httpServer);
    } catch (error) {
      logError("Failed to close HTTP server", error);
    }
  }

  closeDatabase(resources.db);
}

async function configureAdminMenu(bot) {
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
      hypothesisId: "H2_MENU_BUTTON_VALUE",
      location: "index.js:configureAdminMenu:entry",
      message: "configureAdminMenu called",
      data: {
        hasWebappUrl: Boolean(WEBAPP_URL),
        webappUrl: WEBAPP_URL,
        adminId: ADMIN_ID,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (!WEBAPP_URL) {
    return;
  }

  try {
    await bot.telegram.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Mini App",
        web_app: { url: WEBAPP_URL },
      },
    });
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "9080fe",
      },
      body: JSON.stringify({
        sessionId: "9080fe",
        runId: "post-fix",
        hypothesisId: "H9_GLOBAL_MENU_BUTTON",
        location: "index.js:configureAdminMenu:globalSuccess",
        message: "Global web_app menu button configured",
        data: {
          webappUrl: WEBAPP_URL,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    await bot.telegram.setChatMenuButton({
      chat_id: ADMIN_ID,
      menu_button: {
        type: "web_app",
        text: "Админ-панель",
        web_app: { url: WEBAPP_URL },
      },
    });
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
        hypothesisId: "H3_MENU_BUTTON_SET_RESULT",
        location: "index.js:configureAdminMenu:success",
        message: "setChatMenuButton succeeded",
        data: { webappUrl: WEBAPP_URL, adminId: ADMIN_ID },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "9080fe",
      },
      body: JSON.stringify({
        sessionId: "9080fe",
        runId: "post-fix",
        hypothesisId: "H9_GLOBAL_MENU_BUTTON",
        location: "index.js:configureAdminMenu:globalOrAdminCatch",
        message: "Failed to configure menu button",
        data: {
          webappUrl: WEBAPP_URL,
          adminId: ADMIN_ID,
          errorMessage: error?.message || String(error),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
        hypothesisId: "H3_MENU_BUTTON_SET_RESULT",
        location: "index.js:configureAdminMenu:catch",
        message: "setChatMenuButton failed",
        data: {
          webappUrl: WEBAPP_URL,
          adminId: ADMIN_ID,
          errorMessage: error?.message || String(error),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    logError("Failed to configure admin menu button", error);
  }
}

async function bootstrap() {
  void debugIngest({
    runId: "startup",
    hypothesisId: "BOOTSTRAP",
    location: "index.js:bootstrap:start",
    message: "Application bootstrap started",
    data: {
      pid: process.pid,
      port: PORT,
    },
  });

  const db = createDatabase();
  const repos = createRepositories(db);
  const bot = createBot({ db, repos });
  const webServer = createWebServer({
    repos,
    botToken: BOT_TOKEN,
    adminId: ADMIN_ID,
  });

  const resources = {
    db,
    repos,
    bot,
    botLaunched: false,
    webServer,
    httpServer: null,
  };

  try {
    resources.httpServer = await startHttpServer(webServer, PORT);
    logInfo(`Web server started on port ${PORT}`);

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
        hypothesisId: "H5_BOOT_FLOW",
        location: "index.js:bootstrap:beforeBotLaunch",
        message: "About to call bot.launch",
        data: { port: PORT },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await bot.launch();
    resources.botLaunched = true;
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "9080fe",
      },
      body: JSON.stringify({
        sessionId: "9080fe",
        runId: "post-fix",
        hypothesisId: "H5_BOOT_FLOW",
        location: "index.js:bootstrap:afterBotLaunchInit",
        message: "bot.launch initiated without await",
        data: { port: PORT },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    logInfo("Bot started");

    await configureAdminMenu(bot);

    void debugIngest({
      runId: "startup",
      hypothesisId: "BOOTSTRAP",
      location: "index.js:bootstrap:ready",
      message: "Application bootstrap completed",
      data: {
        port: PORT,
        webAppConfigured: Boolean(WEBAPP_URL),
      },
    });

    return resources;
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "8930e6",
      },
      body: JSON.stringify({
        sessionId: "8930e6",
        runId: "pre-fix",
        hypothesisId: "H2_BOOTSTRAP_FAILURE_CAUSE",
        location: "index.js:bootstrap:catch",
        message: "Bootstrap failed before app ready",
        data: {
          errorCode: error?.code || null,
          errorMessage: error?.message || String(error),
          configuredPort: PORT,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await teardown(resources, "bootstrap_failed");
    throw error;
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  await teardown(appResources, signal);
}

async function handleFatalError(type, error) {
  logError(`${type} detected`, error);

  void debugIngest({
    runId: "runtime",
    hypothesisId: "FATAL",
    location: `index.js:${type}`,
    message: "Fatal process error",
    data: {
      errorMessage: error?.message || String(error),
    },
  });

  process.exitCode = 1;
  await shutdown(type);
  process.exit(1);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  void handleFatalError("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${reason}`);
  void handleFatalError("unhandledRejection", error);
});

bootstrap()
  .then((resources) => {
    appResources = resources;
  })
  .catch(async (error) => {
    logError("Application bootstrap failed", error);

    void debugIngest({
      runId: "startup",
      hypothesisId: "BOOTSTRAP",
      location: "index.js:bootstrap:failed",
      message: "Application bootstrap failed",
      data: {
        errorMessage: error?.message,
      },
    });

    process.exitCode = 1;
    process.exit(1);
  });
