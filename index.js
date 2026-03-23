const { createDatabase } = require("./src/db/sqlite");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const {
  BOT_TOKEN,
  ADMIN_ID,
  PORT,
  API_SECRET,
  WEBHOOK_DOMAIN,
  CORS_ORIGIN,
  isProduction,
} = require("./src/config/env");
const { createWebServer } = require("./src/web/server");
const {
  createConversationService,
} = require("./src/services/conversation-service");
const { createSchedulerService } = require("./src/services/scheduler-service");
const { logError, logInfo } = require("./src/utils/logger");

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
    server.close((error) => (error ? reject(error) : resolve()));
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

  if (resources.sessionCleanupTimer) {
    clearInterval(resources.sessionCleanupTimer);
  }
  if (resources.schedulerTimers) {
    resources.schedulerTimers.forEach((t) => clearInterval(t));
  }

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

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function startSessionCleanup(repos) {
  const timer = setInterval(() => {
    try {
      repos.sessions.clearExpired();
    } catch (error) {
      logError("Session cleanup failed", error);
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

function startScheduledTasks(scheduler) {
  const staleTimer = setInterval(() => {
    scheduler.checkStaleLeads().catch((err) => logError("Stale leads check failed", err));
  }, 30 * 60 * 1000);
  staleTimer.unref();

  const followUpTimer = setInterval(() => {
    scheduler.sendFollowUps().catch((err) => logError("Follow-ups check failed", err));
  }, 60 * 60 * 1000);
  followUpTimer.unref();

  return [staleTimer, followUpTimer];
}

async function bootstrap() {
  const db = createDatabase();
  const repos = createRepositories(db);
  const bot = createBot({ db, repos });

  const conversationService = createConversationService({
    repos,
    bot,
    adminId: ADMIN_ID,
  });

  const scheduler = createSchedulerService({
    repos,
    bot,
    adminId: ADMIN_ID,
  });

  const webServer = createWebServer({
    repos,
    conversationService,
    bot,
    adminId: ADMIN_ID,
    apiSecret: API_SECRET,
    corsOrigin: CORS_ORIGIN,
    isProduction,
  });

  // Mount webhook handler if using webhook mode
  if (WEBHOOK_DOMAIN) {
    const webhookPath = `/webhook/${BOT_TOKEN}`;
    webServer.use(bot.webhookCallback(webhookPath));
  }

  const resources = {
    db,
    repos,
    bot,
    botLaunched: false,
    httpServer: null,
    sessionCleanupTimer: null,
    schedulerTimers: null,
  };

  try {
    resources.httpServer = await startHttpServer(webServer, PORT);
    logInfo(`API server started on port ${PORT}`);

    // Launch bot
    try {
      if (WEBHOOK_DOMAIN) {
        const webhookUrl = `${WEBHOOK_DOMAIN}/webhook/${BOT_TOKEN}`;
        await bot.telegram.setWebhook(webhookUrl);
        resources.botLaunched = true;
        logInfo(`Bot started in webhook mode: ${WEBHOOK_DOMAIN}`);
      } else {
        await bot.launch();
        resources.botLaunched = true;
        logInfo("Bot started in polling mode");
      }
    } catch (error) {
      if (isProduction) {
        throw error;
      }
      logError("Bot launch failed; continuing in API-only mode", error);
    }

    resources.sessionCleanupTimer = startSessionCleanup(repos);
    resources.schedulerTimers = startScheduledTasks(scheduler);
    repos.sessions.clearExpired();

    return resources;
  } catch (error) {
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
    process.exitCode = 1;
    process.exit(1);
  });
