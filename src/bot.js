const { Telegraf } = require("telegraf");
const { BOT_TOKEN, ADMIN_ID, WEB_APP_URL, AI_MODEL, AI_ENABLED } = require("./config/env");
const { createAiAgentService } = require("./services/ai-agent-service");
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
  handleClientCancel,
} = require("./handlers/client");
const { createAiService } = require("./services/ai-service");
const { logError } = require("./utils/logger");

function createBot({ db, repos, cacheService = null, queueService = null }) {
  const bot = new Telegraf(BOT_TOKEN);

  const catalog = createCatalogService({ repos });
  const ai = createAiService({ repos });
  const aiAgent = createAiAgentService({
    repos,
    catalogService: catalog,
    config: { enabled: AI_ENABLED, aiModel: AI_MODEL },
  });
  const conversation = createConversationService({
    repos,
    bot,
    adminId: ADMIN_ID,
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
      session,
      leadStatus,
      lead,
      ai,
      aiAgent,
    },
    adminId: ADMIN_ID,
    webAppUrl: WEB_APP_URL,
  };

  bot.catch((error, ctx) => {
    const updateId = ctx?.update?.update_id ?? "unknown";
    logError(`Unhandled bot error for update ${updateId}`, error);
    // Notify the user so they don't see a frozen bot
    ctx?.reply?.("Произошла ошибка. Попробуйте ещё раз или вернитесь в меню /start.")
      ?.catch(() => {});
  });

<<<<<<< Updated upstream
=======
  // Set persistent menu button and command list
  if (webAppUrl) {
    bot.telegram
      .setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Открыть",
          web_app: { url: webAppUrl },
        },
      })
      .catch(() => {});
  }
  bot.telegram
    .setMyCommands([
      { command: "start", description: "Главное меню" },
      { command: "app", description: "Открыть мини-приложение" },
      { command: "menu", description: "Показать меню" },
      { command: "status", description: "Статус заявки" },
      { command: "cancel", description: "Отменить текущую заявку" },
      { command: "help", description: "Помощь" },
      { command: "myid", description: "Узнать свой Telegram ID" },
    ])
    .catch(() => {});

>>>>>>> Stashed changes
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
  bot.command("cancel", async (ctx) => {
    if (ctx.from.id === deps.adminId) return;
    if (ctx.chat.type !== "private") return;
    await handleClientCancel(ctx, deps);
  });

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

  // Graceful reply for unsupported media types
  bot.on(["voice", "video", "video_note", "sticker", "animation"], async (ctx) => {
    if (ctx.chat.type !== "private" || ctx.from.id === deps.adminId) {
      return;
    }
    await ctx
      .reply(
        "Этот тип сообщения не поддерживается. Напишите текстовое сообщение или откройте /menu.",
      )
      .catch(() => {});
  });

  return bot;
}

module.exports = {
  createBot,
};
