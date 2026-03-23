/**
 * Bot_noct - Telegram Bot Application
 * Enhanced version with Redis caching, Bull queues, and advanced monitoring
 */
const { createDatabase } = require("./src/db/sqlite");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const {
  BOT_TOKEN,
  ADMIN_ID,
  PORT,
  API_SECRET,
  WEBHOOK_DOMAIN,
  TELEGRAM_DELIVERY_MODE,
  CORS_ORIGIN,
  isProduction,
} = require("./src/config/env");
const { createWebServer } = require("./src/web/server");
const {
  createConversationService,
} = require("./src/services/conversation-service");
const { createSchedulerService } = require("./src/services/scheduler-service");
const {
  initCacheService,
  getCacheService,
} = require("./src/services/cache-service");
const {
  initQueueService,
  closeQueueService,
  processMessageJobs,
  processWebhookJobs,
} = require("./src/services/queue-service");
const {
  createShutdownHandler,
  createMemoryMonitor,
} = require("./src/utils/graceful-shutdown");
// Import logger with fallback to console if module fails
let log;
try {
  const loggerModule = require("./src/utils/logger-enhanced");
  log = loggerModule.log || loggerModule;
  if (!log || !log.info) {
    throw new Error("Logger module did not export valid log object");
  }
} catch (err) {
  console.error(
    "Failed to load logger-enhanced, using console fallback:",
    err.message,
  );
  log = {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    debug: (...args) => console.debug("[DEBUG]", ...args),
    fatal: (...args) => console.error("[FATAL]", ...args),
  };
}

// Application resources
let appResources = null;
let teardownInProgress = false;

function formatError(error) {
  if (error instanceof Error) {
    return error.message || error.name || String(error);
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function startHttpServer(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]);
}

function shouldUseWebhookMode(webhookDomain) {
  if (!webhookDomain) {
    return false;
  }
  const normalized = String(webhookDomain).trim().toLowerCase();
  // Guard against placeholder values that break local bot updates.
  if (
    normalized.includes("your-app.onrender.com") ||
    normalized.includes("example.com")
  ) {
    return false;
  }
  return true;
}

async function teardown(resources, reason) {
  if (!resources) {
    return;
  }

  if (teardownInProgress) {
    log.warn("Teardown already in progress", { reason });
    return;
  }

  teardownInProgress = true;

  log.info("Starting application teardown", { reason });

  // Clear timers
  if (resources.sessionCleanupTimer) {
    clearInterval(resources.sessionCleanupTimer);
  }
  if (resources.schedulerTimers) {
    resources.schedulerTimers.forEach((t) => clearInterval(t));
  }

  // Stop memory monitor
  if (resources.memoryMonitor) {
    resources.memoryMonitor.stop();
  }

  // Stop bot
  if (resources.botLaunched && resources.bot) {
    try {
      resources.bot.stop(reason);
      log.info("Bot stopped");
    } catch (error) {
      log.error("Error stopping bot", { error: formatError(error) });
    }
  }

  // Close HTTP server
  if (resources.httpServer) {
    try {
      await new Promise((resolve, reject) => {
        resources.httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      log.info("HTTP server closed");
    } catch (error) {
      log.error("Error closing HTTP server", { error: formatError(error) });
    }
  }

  // Close queue service
  if (resources.queueService) {
    try {
      await closeQueueService();
      log.info("Queue service closed");
    } catch (error) {
      log.error("Error closing queue service", { error: formatError(error) });
    }
  }

  // Close cache service
  if (resources.cacheService) {
    try {
      await resources.cacheService.disconnect();
      log.info("Cache service closed");
    } catch (error) {
      log.error("Error closing cache service", { error: formatError(error) });
    }
  }

  // Close database
  if (resources.db) {
    try {
      resources.db.close();
      log.info("Database closed");
    } catch (error) {
      log.error("Error closing database", { error: formatError(error) });
    }
  }

  log.info("Application teardown complete");
  teardownInProgress = false;
}

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function startSessionCleanup(repos) {
  const timer = setInterval(() => {
    try {
      repos.sessions.clearExpired();
      log.debug("Session cleanup completed");
    } catch (error) {
      log.error("Session cleanup failed", { error: formatError(error) });
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

function startScheduledTasks(scheduler) {
  const timers = [];

  // Check stale leads every 30 minutes
  const staleTimer = setInterval(
    () => {
      scheduler
        .checkStaleLeads()
        .catch((err) =>
          log.error("Stale leads check failed", { error: err.message }),
        );
    },
    30 * 60 * 1000,
  );
  staleTimer.unref();
  timers.push(staleTimer);

  // Send follow-ups every hour
  const followUpTimer = setInterval(
    () => {
      scheduler
        .sendFollowUps()
        .catch((err) =>
          log.error("Follow-ups check failed", { error: err.message }),
        );
    },
    60 * 60 * 1000,
  );
  followUpTimer.unref();
  timers.push(followUpTimer);

  return timers;
}

async function bootstrap() {
  log.info("Starting application bootstrap", {
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
  });

  // Initialize database
  const db = createDatabase();
  log.info("Database initialized");

  // Initialize repositories
  const repos = createRepositories(db);

  // Initialize cache service (Redis with in-memory fallback)
  let cacheService = null;
  try {
    cacheService = await initCacheService({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0"),
    });
    log.info("Cache service initialized", {
      mode: cacheService.getMode(),
    });
  } catch (error) {
    log.warn("Cache service initialization failed, continuing without cache", {
      error: formatError(error),
    });
  }

  // Initialize queue service (Bull)
  let queueService = null;
  try {
    await initQueueService({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0"),
    });
    queueService = require("./src/services/queue-service");
    log.info("Queue service initialized");

    // Setup message queue processor
    if (repos.bot) {
      // Bot will be set after bot creation
    }
  } catch (error) {
    log.warn("Queue service initialization failed, continuing without queues", {
      error: formatError(error),
    });
  }

  // Create bot
  const bot = createBot({ db, repos, cacheService, queueService });

  // Setup queue processors with bot instance
  if (queueService) {
    // Process outgoing messages from queue
    processMessageJobs(async (chatId, text, options) => {
      try {
        await bot.telegram.sendMessage(chatId, text, options);
        return { success: true };
      } catch (error) {
        log.error("Failed to send queued message", {
          chatId,
          error: formatError(error),
        });
        throw error;
      }
    });
  }

  // Create services
  const conversationService = createConversationService({
    repos,
    bot,
    adminId: ADMIN_ID,
    cacheService,
    queueService,
  });

  const scheduler = createSchedulerService({
    repos,
    bot,
    adminId: ADMIN_ID,
    cacheService,
  });

  let webhookEnabled = false;
  if (TELEGRAM_DELIVERY_MODE === "webhook") {
    webhookEnabled = shouldUseWebhookMode(WEBHOOK_DOMAIN);
    if (!webhookEnabled) {
      log.warn(
        "Webhook mode requested but domain is not usable; using polling",
        {
          webhookDomain: WEBHOOK_DOMAIN || null,
        },
      );
    }
  }
  log.info("Telegram delivery mode resolved", {
    requestedMode: TELEGRAM_DELIVERY_MODE,
    effectiveMode: webhookEnabled ? "webhook" : "polling",
  });

  // Create web server
  const webServer = createWebServer({
    repos,
    conversationService,
    bot,
    adminId: ADMIN_ID,
    apiSecret: API_SECRET,
    corsOrigin: CORS_ORIGIN,
    isProduction,
    compressionEnabled: process.env.API_COMPRESSION !== "false",
    cacheService,
    queueService,
  });

  // Mount webhook handler if using webhook mode
  if (webhookEnabled) {
    const webhookPath = `/webhook/${BOT_TOKEN}`;
    webServer.use(bot.webhookCallback(webhookPath));
    log.info("Webhook handler mounted", { path: webhookPath });
  }

  // Initialize resources
  const resources = {
    db,
    repos,
    bot,
    botLaunched: false,
    httpServer: null,
    sessionCleanupTimer: null,
    schedulerTimers: null,
    memoryMonitor: null,
    cacheService,
    queueService,
  };

  try {
    // Start HTTP server
    resources.httpServer = await startHttpServer(webServer, PORT);
    log.info(`HTTP server started on port ${PORT}`);

    // Launch bot
    try {
      const telegramStartupTimeoutMs = Number.parseInt(
        process.env.TELEGRAM_STARTUP_TIMEOUT_MS || "15000",
        10,
      );
      if (webhookEnabled) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "7f4ee9",
            },
            body: JSON.stringify({
              sessionId: "7f4ee9",
              runId: "initial",
              hypothesisId: "H1",
              location: "index.js:365",
              message: "about to start bot in webhook mode",
              data: { webhookEnabled, webhookDomain: WEBHOOK_DOMAIN || null },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
        // #endregion
        const webhookUrl = `${WEBHOOK_DOMAIN}/webhook/${BOT_TOKEN}`;
        await withTimeout(
          bot.telegram.setWebhook(webhookUrl),
          telegramStartupTimeoutMs,
          "setWebhook",
        );
        // #region agent log
        fetch(
          "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "7f4ee9",
            },
            body: JSON.stringify({
              sessionId: "7f4ee9",
              runId: "initial",
              hypothesisId: "H1",
              location: "index.js:369",
              message: "setWebhook completed",
              data: { webhookUrl },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
        // #endregion
        resources.botLaunched = true;
        log.info("Bot started in webhook mode", { webhookUrl });
      } else {
        // #region agent log
        fetch(
          "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "7f4ee9",
            },
            body: JSON.stringify({
              sessionId: "7f4ee9",
              runId: "initial",
              hypothesisId: "H2",
              location: "index.js:373",
              message: "about to launch bot in polling mode",
              data: { webhookEnabled, port: PORT },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
        // #endregion
        await withTimeout(bot.launch(), telegramStartupTimeoutMs, "bot.launch");
        // #region agent log
        fetch(
          "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "7f4ee9",
            },
            body: JSON.stringify({
              sessionId: "7f4ee9",
              runId: "initial",
              hypothesisId: "H2",
              location: "index.js:375",
              message: "bot.launch completed in polling mode",
              data: { webhookEnabled },
              timestamp: Date.now(),
            }),
          },
        ).catch(() => {});
        // #endregion
        resources.botLaunched = true;
        log.info("Bot started in polling mode");
      }
    } catch (error) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "7f4ee9",
          },
          body: JSON.stringify({
            sessionId: "7f4ee9",
            runId: "initial",
            hypothesisId: "H3",
            location: "index.js:381",
            message: "bot launch/setWebhook failed",
            data: {
              name: error?.name || null,
              message: error?.message || null,
              code: error?.code || null,
              isProduction,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      if (isProduction) {
        throw error;
      }
      log.warn("Bot launch failed; continuing in API-only mode", {
        error: formatError(error),
      });
    }

    // Start session cleanup
    resources.sessionCleanupTimer = startSessionCleanup(repos);
    repos.sessions.clearExpired();

    // Start scheduled tasks
    resources.schedulerTimers = startScheduledTasks(scheduler);

    // Start memory monitor
    const memoryLimitWarn =
      parseInt(process.env.MEMORY_LIMIT_WARN || "512") * 1024 * 1024;
    const memoryLimitCritical =
      parseInt(process.env.MEMORY_LIMIT_CRITICAL || "768") * 1024 * 1024;

    resources.memoryMonitor = createMemoryMonitor({
      warnThreshold: memoryLimitWarn,
      criticalThreshold: memoryLimitCritical,
      checkInterval: 30000,
    });
    resources.memoryMonitor.start();

    // Setup graceful shutdown
    const shutdownHandler = createShutdownHandler({
      bot: resources.bot,
      cache: resources.cacheService,
      queue: resources.queueService,
      db: resources.db,
      server: resources.httpServer,
    });
    shutdownHandler.registerShutdownHandlers();

    log.info("Application bootstrap completed successfully", {
      uptime: process.uptime(),
    });

    return resources;
  } catch (error) {
    log.error("Application bootstrap failed", {
      error: formatError(error),
      stack: error.stack,
    });
    await teardown(resources, "bootstrap_failed");
    throw error;
  }
}

// Handle fatal errors
process.on("uncaughtException", (error) => {
  // Use console if log is not yet initialized (module loading errors)
  if (typeof log !== "undefined" && log?.error) {
    log.error("Uncaught exception", error, { stack: error.stack });
  } else {
    console.error("Uncaught exception (logger not ready):", error);
  }
  teardown(appResources, "uncaughtException").then(() => {
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${reason}`);
  if (typeof log !== "undefined" && log?.error) {
    log.error("Unhandled rejection", error, { stack: error.stack });
  } else {
    console.error("Unhandled rejection (logger not ready):", error);
  }
  teardown(appResources, "unhandledRejection").then(() => {
    process.exit(1);
  });
});

// Bootstrap application
bootstrap()
  .then((resources) => {
    appResources = resources;
    log.info("Application is ready", {
      uptime: process.uptime(),
      pid: process.pid,
    });
  })
  .catch((error) => {
    if (typeof log !== "undefined" && log?.error) {
      log.error("Application failed to start", {
        error: formatError(error),
        stack: error.stack,
      });
    } else {
      console.error("Application failed to start:", error);
    }
    process.exit(1);
  });
