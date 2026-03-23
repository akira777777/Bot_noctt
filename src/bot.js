const { Telegraf } = require("telegraf");
const {
  createConversationService,
} = require("./services/conversation-service");
const { createLeadService } = require("./services/lead-service");
const { createAdminService } = require("./services/admin-service");
const { createCatalogService } = require("./services/catalog-service");
const { createSessionService } = require("./services/session-service");
const { createLeadStatusService } = require("./services/lead-status-service");
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
  handleClientMiniApp,
  handleClientStatus,
  handleClientText,
  handleClientAction,
  handleClientMedia,
} = require("./handlers/client");
const { createAiService } = require("./services/ai-service");
const { logError } = require("./utils/logger");

function createBot({
  db,
  repos,
  botToken,
  adminId,
  webAppUrl = null,
  cacheService = null,
  queueService = null,
}) {
  const bot = new Telegraf(botToken);

  const catalog = createCatalogService({ repos });
  const ai = createAiService({ repos });
  const conversation = createConversationService({
    repos,
    bot,
    adminId,
    cacheService,
    queueService,
    aiService: ai,
  });
  const admin = createAdminService({ repos });
  const session = createSessionService({ repos });
  const leadStatus = createLeadStatusService({ repos, bot });
  const lead = createLeadService({
    db,
    repos,
    bot,
    adminId,
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
      session,
      leadStatus,
      lead,
      ai,
    },
    adminId,
    webAppUrl,
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
  bot.command("app", (ctx) => handleClientMiniApp(ctx, deps));
  bot.command("myid", (ctx) => ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`));

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

  // Photo and document support
  bot.on("photo", async (ctx) => {
    if (ctx.chat.type !== "private" || ctx.from.id === deps.adminId) {
      return;
    }
    await handleClientMedia(ctx, deps, "photo");
  });

  bot.on("document", async (ctx) => {
    if (ctx.chat.type !== "private" || ctx.from.id === deps.adminId) {
      return;
    }
    await handleClientMedia(ctx, deps, "document");
  });

  return bot;
}

module.exports = {
  createBot,
};
