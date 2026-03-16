const { Telegraf } = require("telegraf");
const {
  BOT_TOKEN,
  ADMIN_ID,
  WEBAPP_URL,
  DEBUG_INGEST_URL,
  DEBUG_SESSION_ID,
} = require("./config/env");
const {
  createConversationService,
} = require("./services/conversation-service");
const { createLeadService } = require("./services/lead-service");
const { createAdminService } = require("./services/admin-service");
const { createCatalogService } = require("./services/catalog-service");
const {
  registerAdminCommands,
  handleAdminStart,
  handleAdminText,
  handleAdminAction,
} = require("./handlers/admin");
const {
  handleClientStart,
  handleClientHelp,
  handleClientMenu,
  handleClientStatus,
  handleClientText,
  handleClientAction,
} = require("./handlers/client");
const { logError } = require("./utils/logger");
const { createDebugIngest } = require("./utils/debug-ingest");

function createBot({ db, repos }) {
  const bot = new Telegraf(BOT_TOKEN);
  const debugIngest = createDebugIngest({
    url: DEBUG_INGEST_URL,
    sessionId: DEBUG_SESSION_ID,
  });

  void debugIngest({
    runId: "startup",
    hypothesisId: "BOT_INIT",
    location: "src/bot.js:createBot",
    message: "Bot initialization context",
    data: {
      hasToken: Boolean(BOT_TOKEN),
      adminId: ADMIN_ID,
    },
  });

  const catalog = createCatalogService({ repos });
  const conversation = createConversationService({
    repos,
    bot,
    adminId: ADMIN_ID,
  });
  const admin = createAdminService({ repos });
  const lead = createLeadService({
    db,
    repos,
    bot,
    adminId: ADMIN_ID,
    catalogService: catalog,
    conversationService: conversation,
  });

  const deps = {
    bot,
    db,
    repos,
    services: {
      catalog,
      conversation,
      admin,
      lead,
    },
    adminId: ADMIN_ID,
    webappUrl: WEBAPP_URL,
  };

  bot.use(async (ctx, next) => {
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
        hypothesisId: "H7_UPDATE_STREAM",
        location: "src/bot.js:bot.use:updateProbe",
        message: "Incoming Telegram update observed",
        data: {
          updateId: ctx?.update?.update_id || null,
          hasMessage: Boolean(ctx?.message),
          messageText: ctx?.message?.text || null,
          fromId: ctx?.from?.id || null,
          chatId: ctx?.chat?.id || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return next();
  });

  bot.catch((error, ctx) => {
    const updateId = ctx?.update?.update_id ?? "unknown";

    void debugIngest({
      runId: "runtime",
      hypothesisId: "BOT_ERROR",
      location: "src/bot.js:bot.catch",
      message: "Unhandled bot error captured",
      data: {
        updateId,
        errorMessage: error?.message,
      },
    });

    logError(`Unhandled bot error for update ${updateId}`, error);
  });

  registerAdminCommands(bot, deps);

  bot.start((ctx) => {
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
        hypothesisId: "H6_START_EVENT",
        location: "src/bot.js:bot.start:entry",
        message: "Received /start update",
        data: {
          fromId: ctx?.from?.id,
          adminId: deps?.adminId,
          isAdmin: ctx?.from?.id === deps?.adminId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    void debugIngest({
      runId: "runtime",
      hypothesisId: "BOT_START",
      location: "src/bot.js:bot.start",
      message: "Start command routing",
      data: {
        fromId: ctx.from?.id,
        isAdmin: ctx.from?.id === deps.adminId,
      },
    });

    if (ctx.from.id === deps.adminId) {
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
            hypothesisId: "H6_START_EVENT",
            location: "src/bot.js:bot.start:adminBranch",
            message: "Routing /start to admin handler",
            data: { fromId: ctx?.from?.id },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      return handleAdminStart(ctx, deps);
    }

    return handleClientStart(ctx, deps);
  });

  bot.help((ctx) => handleClientHelp(ctx, deps));
  bot.command("menu", (ctx) => handleClientMenu(ctx, deps));
  bot.command("status", (ctx) => handleClientStatus(ctx, deps));

  bot.action(/^(catalog|lead|contact|info|menu):.*$/, (ctx) =>
    handleClientAction(ctx, deps),
  );
  bot.action(/^admin:.*$/, (ctx) => handleAdminAction(ctx, deps));

  bot.on("text", async (ctx) => {
    void debugIngest({
      runId: "runtime",
      hypothesisId: "BOT_TEXT",
      location: "src/bot.js:bot.on(text)",
      message: "Incoming text event",
      data: {
        chatType: ctx.chat?.type,
        textStartsWithSlash: Boolean(ctx.message?.text?.startsWith("/")),
        fromId: ctx.from?.id,
      },
    });

    if (ctx.chat.type !== "private") {
      return;
    }

    if (ctx.message.text.startsWith("/")) {
      return;
    }

    if (ctx.from.id === deps.adminId) {
      await handleAdminText(ctx, deps);
      return;
    }

    await handleClientText(ctx, deps);
  });

  return bot;
}

module.exports = {
  createBot,
};
