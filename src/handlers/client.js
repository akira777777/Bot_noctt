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
const { ACTIONS, ACTION_PREFIXES, parseActionId } = require("../utils/actions");
const { rejectBlocked, createClientAccessGuard } = require("./guards");

const HOME_ACTION_LABELS = {
  "Оставить заявку": ACTIONS.LEAD_START,
  Каталог: ACTIONS.CATALOG_ROOT,
  "Связаться с менеджером": ACTIONS.CONTACT_MANAGER,
  "Как оформить заказ": ACTIONS.INFO_HOW_TO_ORDER,
};

async function showHomeScreen(ctx, deps, entry) {
  deps.services.session.setHomeSession(ctx.from.id, entry.raw);
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
  const sourcePayload = deps.services.session.getCurrentSourcePayload(ctx.from.id);
  deps.services.session.setHomeSession(ctx.from.id, sourcePayload);
  await ctx.reply(contactManagerMessage(), backToMainKeyboard());
}

async function handleHomeAction(ctx, deps, action) {
  switch (action) {
    case ACTIONS.CATALOG_ROOT:
      await showCatalog(ctx, deps);
      return true;
    case ACTIONS.LEAD_START:
      await showLeadEntry(ctx, deps);
      return true;
    case ACTIONS.CONTACT_MANAGER:
      await showSupportEntry(ctx, deps);
      return true;
    case ACTIONS.INFO_HOW_TO_ORDER:
      await ctx.reply(howToOrderMessage(), backToMainKeyboard());
      return true;
    case ACTIONS.MENU_MAIN: {
      const sourcePayload = deps.services.session.getCurrentSourcePayload(
        ctx.from.id,
      );
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

    if (!result.ok) {
      await ctx.reply(result.error, commentKeyboard());
      return true;
    }

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

async function handleClientStart(ctx, deps) {
  const ensureClientAccess = createClientAccessGuard(deps);
  const access = await ensureClientAccess(ctx);
  if (!access.ok) {
    await rejectBlocked(ctx);
    return;
  }
  const entry = parseSourcePayload(ctx.startPayload);

  await showHomeScreen(ctx, deps, entry);
  if (deps.webappUrl) {
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
  const sourcePayload = deps.services.session.getCurrentSourcePayload(ctx.from.id);
  await showHomeScreen(ctx, deps, parseSourcePayload(sourcePayload));
}

async function handleClientStatus(ctx, deps) {
  const ensureClientAccess = createClientAccessGuard(deps);
  const access = await ensureClientAccess(ctx);
  if (!access.ok) {
    await rejectBlocked(ctx);
    return;
  }
  const lead = deps.services.admin.getLatestLeadByClient(ctx.from.id);
  await ctx.reply(clientLeadStatusMessage(lead), backToMainKeyboard());
}

async function handleClientText(ctx, deps) {
  const ensureClientAccess = createClientAccessGuard(deps);
  const access = await ensureClientAccess(ctx);
  if (!access.ok) {
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

  const sourcePayload = deps.services.session.getCurrentSourcePayload(ctx.from.id);
  await deps.services.conversation.forwardClientMessage({
    client: ctx.from,
    chatId: ctx.chat.id,
    text: ctx.message.text,
    sourcePayload,
  });
  await ctx.reply(clientMessageDelivered(), backToMainKeyboard());
}

async function handleClientAction(ctx, deps) {
  const ensureClientAccess = createClientAccessGuard(deps);
  const access = await ensureClientAccess(ctx);
  if (!access.ok) {
    await ctx.answerCbQuery("Ваш аккаунт заблокирован.").catch(() => {});
    return;
  }

  const action = ctx.match[0];
  switch (action) {
    case ACTIONS.MENU_MAIN:
      await safeAnswerCbQuery(ctx);
      await handleClientMenu(ctx, deps);
      return;
    case ACTIONS.INFO_HOW_TO_ORDER:
    case ACTIONS.CONTACT_MANAGER:
    case ACTIONS.CATALOG_ROOT:
      await safeAnswerCbQuery(ctx);
      await handleHomeAction(ctx, deps, action);
      return;
  }

  if (action.startsWith(ACTION_PREFIXES.CATALOG_PRODUCT)) {
    const parsed = parseActionId(action, ACTION_PREFIXES.CATALOG_PRODUCT);
    if (!parsed.ok) {
      await safeAnswerCbQuery(ctx, "Некорректные данные");
      return;
    }
    const productId = parsed.id;
    const product = deps.services.catalog.getProductById(productId);
    if (!product) {
      await safeAnswerCbQuery(ctx, "Товар не найден");
      return;
    }

    await safeAnswerCbQuery(ctx);
    await ctx.reply(buildProductCard(product), productCardKeyboard(product.id));
    return;
  }

  if (action === ACTIONS.LEAD_START) {
    await safeAnswerCbQuery(ctx);
    await showLeadEntry(ctx, deps);
    return;
  }

  if (action.startsWith(ACTION_PREFIXES.LEAD_PRODUCT)) {
    const parsed = parseActionId(action, ACTION_PREFIXES.LEAD_PRODUCT);
    if (!parsed.ok) {
      await safeAnswerCbQuery(ctx, "Некорректные данные");
      return;
    }
    const productId = parsed.id;
    const product = deps.services.lead.hydrateProductForLead(productId);
    if (!product) {
      await safeAnswerCbQuery(ctx, "Товар не найден");
      return;
    }

    const sourcePayload = deps.services.session.getCurrentSourcePayload(
      ctx.from.id,
    );
    deps.services.lead.startLeadDraft({
      clientId: ctx.from.id,
      product,
      sourcePayload,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "quantity", { product });
    return;
  }

  if (action === ACTIONS.LEAD_SKIP_COMMENT) {
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

  if (action === ACTIONS.LEAD_CONTACT_TELEGRAM) {
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

  if (action === ACTIONS.LEAD_CONTACT_CUSTOM) {
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

  if (action === ACTIONS.LEAD_CONFIRM) {
    const sourcePayload = deps.services.session.getCurrentSourcePayload(
      ctx.from.id,
    );
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
      deps.services.session.clearSession(ctx.from.id);
      deps.services.session.setHomeSession(ctx.from.id, sourcePayload);
      await ctx.reply(
        `⚠️ У вас уже есть активная заявка на этот товар (#${lead.existingLead.id}). Дождитесь её обработки или свяжитесь с менеджером.`,
        backToMainKeyboard(),
      );
      return;
    }

    deps.services.session.setHomeSession(ctx.from.id, sourcePayload);
    await ctx.reply(leadCreatedMessage(), backToMainKeyboard());
    return;
  }

  if (action === ACTIONS.LEAD_BACK) {
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

  if (action === ACTIONS.LEAD_CANCEL) {
    const sourcePayload = deps.services.session.getCurrentSourcePayload(
      ctx.from.id,
    );
    deps.services.lead.clearSession(ctx.from.id);
    deps.services.session.setHomeSession(ctx.from.id, sourcePayload);
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
