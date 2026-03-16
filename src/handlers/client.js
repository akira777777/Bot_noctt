const { Markup } = require("telegraf");
const {
  backToMainKeyboard,
  catalogKeyboard,
  productCardKeyboard,
  quantityKeyboard,
  commentKeyboard,
  contactKeyboard,
  customContactKeyboard,
  confirmLeadKeyboard,
} = require("../ui/keyboards");
const { clientHomeReplyKeyboard } = require("../ui/reply-keyboards");
const {
  welcomeMessage,
  helpMessage,
  askQuantityMessage,
  askCommentMessage,
  askContactMessage,
  askCustomContactMessage,
  leadSummaryMessage,
  leadCreatedMessage,
  howToOrderMessage,
  contactManagerMessage,
  clientMessageDelivered,
  clientLeadStatusMessage,
} = require("../ui/messages");
const { buildCatalogIntro, buildProductCard } = require("../ui/catalog-view");
const { safeAnswerCbQuery } = require("../utils/telegram");
const {
  parseSourcePayload,
  resolveStartAction,
} = require("../utils/source-payload");

const HOME_ACTION_LABELS = {
  "Оставить заявку": "lead:start",
  Каталог: "catalog:root",
  "Связаться с менеджером": "contact:manager",
  "Как оформить заказ": "info:how_to_order",
};

function getCurrentSourcePayload(repos, clientId, fallbackSource = null) {
  const session = repos.sessions.get(clientId);
  return session?.draft?.sourcePayload || fallbackSource || null;
}

function setHomeSession(repos, clientId, sourcePayload) {
  repos.sessions.set(clientId, "home", "menu", {
    sourcePayload: sourcePayload || null,
  });
}

function parseActionId(action) {
  return Number(action.split(":")[2]);
}

async function showHomeScreen(ctx, deps, entry) {
  setHomeSession(deps.repos, ctx.from.id, entry.raw);
  await ctx.reply(welcomeMessage(entry), clientHomeReplyKeyboard());
}

async function showCatalog(ctx, deps) {
  const products = deps.services.catalog.listProducts();
  await ctx.reply(buildCatalogIntro(products), catalogKeyboard(products));
}

async function showLeadEntry(ctx, deps) {
  const products = deps.services.catalog.listProducts();
  await ctx.reply(
    "Выберите товар, чтобы начать заявку.",
    catalogKeyboard(products),
  );
}

async function showSupportEntry(ctx, deps) {
  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  setHomeSession(deps.repos, ctx.from.id, sourcePayload);
  await ctx.reply(contactManagerMessage(), backToMainKeyboard());
}

async function handleHomeAction(ctx, deps, action) {
  switch (action) {
    case "catalog:root":
      await showCatalog(ctx, deps);
      return true;
    case "lead:start":
      await showLeadEntry(ctx, deps);
      return true;
    case "contact:manager":
      await showSupportEntry(ctx, deps);
      return true;
    case "info:how_to_order":
      await ctx.reply(howToOrderMessage(), backToMainKeyboard());
      return true;
    case "menu:main": {
      const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
      await showHomeScreen(ctx, deps, parseSourcePayload(sourcePayload));
      return true;
    }
    default:
      return false;
  }
}

async function showLeadStep(ctx, step, payload = {}) {
  switch (step) {
    case "quantity":
      await ctx.reply(askQuantityMessage(payload.product), quantityKeyboard());
      return;
    case "comment":
      await ctx.reply(askCommentMessage(), commentKeyboard());
      return;
    case "contact":
      await ctx.reply(askContactMessage(), contactKeyboard());
      return;
    case "contact_custom":
      await ctx.reply(askCustomContactMessage(), customContactKeyboard());
      return;
    case "confirm":
      await ctx.reply(leadSummaryMessage(payload.draft), confirmLeadKeyboard());
      return;
  }
}

async function handleLeadText(ctx, deps, session) {
  if (session.step === "quantity") {
    const result = deps.services.lead.saveQuantity({
      clientId: ctx.from.id,
      session,
      rawQuantity: ctx.message.text,
    });

    if (!result.ok) {
      await ctx.reply(result.error, quantityKeyboard());
      return true;
    }

    await showLeadStep(ctx, "comment");
    return true;
  }

  if (session.step === "comment") {
    const result = deps.services.lead.saveComment({
      clientId: ctx.from.id,
      session,
      comment: ctx.message.text,
    });

    await showLeadStep(ctx, "contact", result);
    return true;
  }

  if (session.step === "contact_custom") {
    const result = deps.services.lead.saveCustomContact({
      clientId: ctx.from.id,
      session,
      contactText: ctx.message.text,
    });

    if (!result.ok) {
      await ctx.reply(result.error, customContactKeyboard());
      return true;
    }

    await showLeadStep(ctx, "confirm", result);
    return true;
  }

  if (session.step === "contact") {
    await ctx.reply("Выберите способ связи кнопкой ниже.", contactKeyboard());
    return true;
  }

  if (session.step === "confirm") {
    await ctx.reply(
      "Подтвердите заявку кнопкой ниже или вернитесь назад.",
      confirmLeadKeyboard(),
    );
    return true;
  }

  return false;
}

function isUserBlocked(user) {
  return user && user.is_blocked;
}

async function rejectBlocked(ctx) {
  await ctx.reply("Ваш аккаунт заблокирован. Обратитесь к администратору.");
}

async function handleClientStart(ctx, deps) {
  const user = deps.services.conversation.upsertTelegramUser(
    ctx.from,
    "client",
  );
  if (isUserBlocked(user)) {
    await rejectBlocked(ctx);
    return;
  }
  const entry = parseSourcePayload(ctx.startPayload);

  await showHomeScreen(ctx, deps, entry);
  if (deps.webappUrl) {
    try {
      await deps.bot.telegram.setChatMenuButton({
        chat_id: ctx.from.id,
        menu_button: {
          type: "web_app",
          text: "Mini App",
          web_app: { url: deps.webappUrl },
        },
      });
    } catch (error) {
      // setChatMenuButton failed silently — non-critical
    }
    await ctx.reply(
      "Открыть Mini App:",
      Markup.inlineKeyboard([
        [Markup.button.webApp("Открыть Mini App", deps.webappUrl)],
      ]),
    );
  }

  const startAction = resolveStartAction(entry);
  if (startAction === "catalog") {
    await showCatalog(ctx, deps);
    return;
  }

  if (startAction === "lead") {
    await showLeadEntry(ctx, deps);
    return;
  }

  if (startAction === "support") {
    await showSupportEntry(ctx, deps);
  }
}

async function handleClientHelp(ctx) {
  await ctx.reply(helpMessage(), backToMainKeyboard());
}

async function handleClientMenu(ctx, deps) {
  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  await showHomeScreen(ctx, deps, parseSourcePayload(sourcePayload));
}

async function handleClientStatus(ctx, deps) {
  const user = deps.services.conversation.upsertTelegramUser(
    ctx.from,
    "client",
  );
  if (isUserBlocked(user)) {
    await rejectBlocked(ctx);
    return;
  }
  const lead = deps.repos.leads.getLatestByClient(ctx.from.id);
  await ctx.reply(clientLeadStatusMessage(lead), backToMainKeyboard());
}

async function handleClientText(ctx, deps) {
  const user = deps.services.conversation.upsertTelegramUser(
    ctx.from,
    "client",
  );
  if (isUserBlocked(user)) {
    await rejectBlocked(ctx);
    return;
  }

  const session = deps.services.lead.getSession(ctx.from.id);
  if (session?.flow === "lead") {
    const handled = await handleLeadText(ctx, deps, session);
    if (handled) {
      return;
    }
  }

  const homeAction = HOME_ACTION_LABELS[ctx.message.text];
  if (homeAction) {
    await handleHomeAction(ctx, deps, homeAction);
    return;
  }

  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  await deps.services.conversation.forwardClientMessage({
    client: ctx.from,
    chatId: ctx.chat.id,
    text: ctx.message.text,
    sourcePayload,
  });
  await ctx.reply(clientMessageDelivered(), backToMainKeyboard());
}

async function handleClientAction(ctx, deps) {
  const user = deps.services.conversation.upsertTelegramUser(
    ctx.from,
    "client",
  );
  if (isUserBlocked(user)) {
    await ctx.answerCbQuery("Ваш аккаунт заблокирован.").catch(() => {});
    return;
  }

  const action = ctx.match[0];
  switch (action) {
    case "menu:main":
      await safeAnswerCbQuery(ctx);
      await handleClientMenu(ctx, deps);
      return;
    case "info:how_to_order":
    case "contact:manager":
    case "catalog:root":
      await safeAnswerCbQuery(ctx);
      await handleHomeAction(ctx, deps, action);
      return;
  }

  if (action.startsWith("catalog:product:")) {
    const productId = parseActionId(action);
    const product = deps.services.catalog.getProductById(productId);
    if (!product) {
      await safeAnswerCbQuery(ctx, "Товар не найден");
      return;
    }

    await safeAnswerCbQuery(ctx);
    await ctx.reply(buildProductCard(product), productCardKeyboard(product.id));
    return;
  }

  if (action === "lead:start") {
    await safeAnswerCbQuery(ctx);
    await showLeadEntry(ctx, deps);
    return;
  }

  if (action.startsWith("lead:product:")) {
    const productId = parseActionId(action);
    const product = deps.services.lead.hydrateProductForLead(productId);
    if (!product) {
      await safeAnswerCbQuery(ctx, "Товар не найден");
      return;
    }

    const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
    deps.services.lead.startLeadDraft({
      clientId: ctx.from.id,
      product,
      sourcePayload,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "quantity", { product });
    return;
  }

  if (action === "lead:skip_comment") {
    const session = deps.services.lead.getSession(ctx.from.id);
    if (!session) {
      await safeAnswerCbQuery(ctx, "Сессия не найдена");
      return;
    }

    const result = deps.services.lead.skipComment({
      clientId: ctx.from.id,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "contact", result);
    return;
  }

  if (action === "lead:contact_telegram") {
    const session = deps.services.lead.getSession(ctx.from.id);
    if (!session) {
      await safeAnswerCbQuery(ctx, "Сессия не найдена");
      return;
    }

    const result = deps.services.lead.useTelegramContact({
      client: ctx.from,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "confirm", result);
    return;
  }

  if (action === "lead:contact_custom") {
    const session = deps.services.lead.getSession(ctx.from.id);
    if (!session) {
      await safeAnswerCbQuery(ctx, "Сессия не найдена");
      return;
    }

    deps.services.lead.requestCustomContact({
      clientId: ctx.from.id,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "contact_custom");
    return;
  }

  if (action === "lead:confirm") {
    const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
    await safeAnswerCbQuery(ctx);
    const lead = await deps.services.lead.confirmLead({
      client: ctx.from,
      chatId: ctx.chat.id,
    });

    if (!lead) {
      await ctx.reply(
        "Не удалось подтвердить заявку. Попробуйте начать заново.",
        backToMainKeyboard(),
      );
      return;
    }

    if (lead.duplicate) {
      deps.repos.sessions.clear(ctx.from.id);
      setHomeSession(deps.repos, ctx.from.id, sourcePayload);
      await ctx.reply(
        `⚠️ У вас уже есть активная заявка на этот товар (#${lead.existingLead.id}). Дождитесь её обработки или свяжитесь с менеджером.`,
        backToMainKeyboard(),
      );
      return;
    }

    setHomeSession(deps.repos, ctx.from.id, sourcePayload);
    await ctx.reply(leadCreatedMessage(), backToMainKeyboard());
    return;
  }

  if (action === "lead:back") {
    const session = deps.services.lead.getSession(ctx.from.id);
    const previousStep = deps.services.lead.goBack(ctx.from.id, session);
    await safeAnswerCbQuery(ctx);

    if (!previousStep) {
      await showLeadEntry(ctx, deps);
      return;
    }

    if (previousStep === "quantity") {
      const product = deps.services.lead.hydrateProductForLead(
        session.draft.productId,
      );
      await showLeadStep(ctx, "quantity", { product });
      return;
    }

    if (previousStep === "comment") {
      await showLeadStep(ctx, "comment");
      return;
    }

    if (previousStep === "contact") {
      await showLeadStep(ctx, "contact");
      return;
    }
  }

  if (action === "lead:cancel") {
    const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
    deps.services.lead.clearSession(ctx.from.id);
    setHomeSession(deps.repos, ctx.from.id, sourcePayload);
    await safeAnswerCbQuery(ctx, "Заявка отменена");
    await ctx.reply("Оформление заявки отменено.", backToMainKeyboard());
  }
}

module.exports = {
  handleClientStart,
  handleClientHelp,
  handleClientMenu,
  handleClientStatus,
  handleClientText,
  handleClientAction,
};
