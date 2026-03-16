const { Telegraf } = require("telegraf");
const {
  BOT_TOKEN,
  ADMIN_ID,
  WEBAPP_URL,
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

function createBot({ db, repos }) {
  const bot = new Telegraf(BOT_TOKEN);

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

  bot.catch((error, ctx) => {
    const updateId = ctx?.update?.update_id ?? "unknown";
    logError(`Unhandled bot error for update ${updateId}`, error);
  });

  registerAdminCommands(bot, deps);

  bot.start((ctx) => {
    if (ctx.from.id === deps.adminId) {
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
