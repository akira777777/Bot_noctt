const { createDatabase } = require("./src/db/sqlite");
const { createRepositories } = require("./src/repositories");
const { createBot } = require("./src/bot");
const {
  BOT_TOKEN,
  ADMIN_ID,
  PORT,
  WEBAPP_URL,
} = require("./src/config/env");
const { createWebServer } = require("./src/web/server");
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

async function bootstrap() {
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

    await bot.launch();
    resources.botLaunched = true;
    logInfo("Bot started");

    await configureAdminMenu(bot);

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
