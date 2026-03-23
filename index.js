const { createDatabase } = require("./src/db/sqlite");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const { isProduction } = require("./src/config/env");
const { logError, logInfo } = require("./src/utils/logger");

let appResources = null;
let isShuttingDown = false;

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

  if (resources.botLaunched) {
    stopBot(resources.bot, reason);
  }

  closeDatabase(resources.db);
}

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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

async function bootstrap() {
  const db = createDatabase();
  const repos = createRepositories(db);
  const bot = createBot({ db, repos });

  const resources = {
    db,
    repos,
    bot,
    botLaunched: false,
    sessionCleanupTimer: null,
  };

  try {
    await bot.launch();
    resources.botLaunched = true;
    logInfo("Bot started");

    resources.sessionCleanupTimer = startSessionCleanup(repos);

    // Clean up expired sessions on startup (hourly timer already set above)
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
