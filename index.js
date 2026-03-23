const { DatabaseConnectionManager } = require("./src/db/connection");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const {
  BOT_TOKEN,
  ADMIN_ID,
  PORT,
  WEBAPP_URL,
  CORS_ORIGIN,
  isProduction,
} = require("./src/config/env");
const {
  createEnhancedWebServer,
  startServer,
  GracefulShutdown,
} = require("./src/web/enhanced-server");
const { runMigrations } = require("./src/db/migrations");
const { logError, logInfo } = require("./src/utils/logger");

// Global state
let appResources = null;
let isShuttingDown = false;

/**
 * Stop Telegram bot gracefully
 */
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

/**
 * Teardown all resources
 */
async function teardown(resources, reason) {
  if (!resources) {
    return;
  }

  logInfo(`Starting teardown due to: ${reason}`);

  // Stop bot first to prevent new messages
  if (resources.botLaunched) {
    stopBot(resources.bot, reason);
  }

  // Close HTTP server (handled by GracefulShutdown)
  // DB shutdown is handled by GracefulShutdown beforeShutdown hook

  // Shutdown database manager
  if (resources.dbManager) {
    try {
      await resources.dbManager.shutdown(30000);
    } catch (error) {
      logError("Failed to shutdown database manager", error);
    }
  }

  // Stop rate limiter cleanup
  if (resources.rateLimiter) {
    resources.rateLimiter.stop();
  }

  logInfo("Teardown complete");
}

/**
 * Configure admin menu button
 */
async function configureAdminMenu(bot) {
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

    await bot.telegram.setChatMenuButton({
      chat_id: ADMIN_ID,
      menu_button: {
        type: "web_app",
        text: "Админ-панель",
        web_app: { url: WEBAPP_URL },
      },
    });
  } catch (error) {
    logError("Failed to configure admin menu button", error);
  }
}

/**
 * Bootstrap the application
 */
async function bootstrap() {
  // Create database manager with retry logic
  const dbManager = new DatabaseConnectionManager(
    require("./src/config/env").DB_PATH,
    {
      maxRetries: 3,
      retryDelayMs: 100,
      healthCheckIntervalMs: 30000,
      busyTimeout: 5000,
    },
  );

  // Connect to database
  await dbManager.connect();

  // Run migrations
  const db = dbManager.getDatabase();
  runMigrations(db);

  // Seed products if needed
  seedProducts(db);

  // Create repositories
  const repos = createRepositories(dbManager);

  // Create bot
  const bot = createBot({ db, repos });

  // Create enhanced web server with rate limiting and timeouts
  const { app, rateLimiter } = createEnhancedWebServer({
    repos,
    dbManager,
    botToken: BOT_TOKEN,
    adminId: ADMIN_ID,
    corsOrigin: CORS_ORIGIN,
    isProduction,
    requestTimeoutMs: 30000,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
  });

  // Start HTTP server
  const httpServer = await startServer(app, PORT);

  // Setup graceful shutdown
  const gracefulShutdown = new GracefulShutdown(httpServer, {
    timeoutMs: 30000,
    beforeShutdown: async () => {
      // Stop accepting new bot updates
      stopBot(bot, "shutdown");
      // Shutdown database
      await dbManager.shutdown(30000);
    },
    afterShutdown: async () => {
      rateLimiter.stop();
    },
  });
  gracefulShutdown.attach();

  // Launch bot
  await bot.launch();

  // Configure admin menu
  await configureAdminMenu(bot);

  logInfo("Application started successfully");

  return {
    dbManager,
    repos,
    bot,
    botLaunched: true,
    httpServer,
    rateLimiter,
    gracefulShutdown,
  };
}

/**
 * Seed default products
 */
function seedProducts(db) {
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get().count;

  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO products (code, title, description, price_text, sort_order)
    VALUES (@code, @title, @description, @price_text, @sort_order)
  `);

  const defaults = [
    {
      code: "basic",
      title: "Базовый пакет",
      description: "Подходит для быстрого старта и базовой консультации.",
      price_text: "Цена уточняется",
      sort_order: 1,
    },
    {
      code: "standard",
      title: "Стандартный пакет",
      description:
        "Оптимальный вариант с расширенной поддержкой и доработками.",
      price_text: "Цена уточняется",
      sort_order: 2,
    },
    {
      code: "premium",
      title: "Премиум пакет",
      description:
        "Для клиентов, которым нужен приоритет и индивидуальные условия.",
      price_text: "Цена уточняется",
      sort_order: 3,
    },
  ];

  const tx = db.transaction(() => {
    for (const product of defaults) {
      insert.run(product);
    }
  });
  tx();

  logInfo("Default products seeded");
}

/**
 * Handle fatal errors
 */
async function handleFatalError(type, error) {
  logError(`${type} detected`, error);
  process.exitCode = 1;

  if (appResources) {
    await teardown(appResources, type);
  }

  process.exit(1);
}

// Process error handlers
process.on("uncaughtException", (error) => {
  void handleFatalError("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${String(reason)}`);
  void handleFatalError("unhandledRejection", error);
});

// Start application
bootstrap()
  .then((resources) => {
    appResources = resources;
  })
  .catch(async (error) => {
    logError("Application bootstrap failed", error);

    if (appResources) {
      await teardown(appResources, "bootstrap_failed");
    }

    process.exitCode = 1;
    process.exit(1);
  });
