const {
  backToMainKeyboard,
  catalogKeyboard,
  productCardKeyboard,
  quantityKeyboard,
  commentKeyboard,
  contactKeyboard,
  customContactKeyboard,
  confirmLeadKeyboard,
  clientMiniAppKeyboard,
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
  rateLimitMessage,
} = require("../ui/messages");
const { buildCatalogIntro, buildProductCard } = require("../ui/catalog-view");
const { safeAnswerCbQuery } = require("../utils/telegram");
const { ACTIONS, parseActionId } = require("../utils/actions");
const { parseSourcePayload } = require("../utils/source-payload");
const { createRateLimiter } = require("../utils/rate-limiter");
const { formatClientLabel } = require("../utils/formatters");

// 5 messages per 60 seconds per user
const messageLimiter = createRateLimiter(5, 60 * 1000);

const HOME_ACTION_LABELS = {
  "🛍 Оставить заявку": "lead:start",
  "📚 Каталог": "catalog:root",
  "💬 Что вас интересует?": "contact:manager",
  "▶️ Продолжить заявку": "lead:resume",
  "📱 Открыть мини-приложение": "miniapp:open",
};
const LEAD_TEXT_COMMANDS = Object.freeze({
  назад: "back",
  отмена: "cancel",
  отменить: "cancel",
});

function getCurrentSourcePayload(repos, clientId, fallbackSource = null) {
  const session = repos.sessions.get(clientId);
  return session?.draft?.sourcePayload || fallbackSource || null;
}

function getActiveLeadDraft(repos, clientId) {
  const session = repos.sessions.get(clientId);
  return session?.flow === "lead" ? session : null;
}

function setHomeSession(repos, clientId, sourcePayload, { force = false } = {}) {
  if (!force && getActiveLeadDraft(repos, clientId)) {
    return;
  }
  repos.sessions.set(clientId, "home", "menu", {
    sourcePayload: sourcePayload || null,
  });
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

async function showHomeScreen(ctx, deps, entry) {
  setHomeSession(deps.repos, ctx.from.id, entry.raw);
  await ctx.reply(
    welcomeMessage(entry),
    clientHomeReplyKeyboard(deps.webAppUrl, {
      hasActiveLeadDraft: Boolean(getActiveLeadDraft(deps.repos, ctx.from.id)),
    }),
  );
}

async function openMiniApp(ctx, deps) {
  if (!deps.webAppUrl) {
    await ctx.reply(
      "Мини-приложение пока не настроено. Добавьте WEB_APP_URL в окружение.",
      backToMainKeyboard(),
    );
    return;
  }

  await ctx.reply(
    "Откройте мини-приложение кнопкой ниже:",
    clientMiniAppKeyboard(deps.webAppUrl),
  );
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

async function showCurrentLeadStep(ctx, deps, session) {
  if (!session || session.flow !== "lead") {
    await showLeadEntry(ctx, deps);
    return;
  }

  switch (session.step) {
    case "quantity": {
      const product = deps.services.lead.hydrateProductForLead(
        session.draft.productId,
      );
      await showLeadStep(ctx, "quantity", { product });
      return;
    }
    case "comment":
    case "contact":
    case "contact_custom":
      await showLeadStep(ctx, session.step, { draft: session.draft });
      return;
    case "confirm":
    default:
      await showLeadStep(ctx, "confirm", { draft: session.draft });
  }
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
    case "lead:resume":
      await showCurrentLeadStep(
        ctx,
        deps,
        deps.services.lead.getSession(ctx.from.id),
      );
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
    case "miniapp:open":
      await openMiniApp(ctx, deps);
      return true;
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
      await ctx.reply(
        leadSummaryMessage(payload.draft),
        confirmLeadKeyboard(payload.draft),
      );
      return;
  }
}

async function showPreviousLeadStep(ctx, deps, session) {
  const previousStep = deps.services.lead.goBack(ctx.from.id, session);
  if (!previousStep) {
    await showLeadEntry(ctx, deps);
    return true;
  }

  if (previousStep === "quantity") {
    const product = deps.services.lead.hydrateProductForLead(
      session.draft.productId,
    );
    await showLeadStep(ctx, "quantity", { product });
    return true;
  }

  if (previousStep === "comment" || previousStep === "contact") {
    await showLeadStep(ctx, previousStep);
    return true;
  }

  return false;
}

async function cancelLeadFlow(ctx, deps) {
  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  if (typeof deps.services.lead.cancelLeadDraft === "function") {
    deps.services.lead.cancelLeadDraft(ctx.from.id);
  } else {
    deps.services.lead.clearSession(ctx.from.id);
  }
  setHomeSession(deps.repos, ctx.from.id, sourcePayload, { force: true });
  await ctx.reply("Оформление заявки отменено.", backToMainKeyboard());
}

async function handleLeadText(ctx, deps, session) {
  const normalizedCommand =
    LEAD_TEXT_COMMANDS[normalizeText(ctx.message.text).toLowerCase()];
  if (normalizedCommand === "cancel") {
    await cancelLeadFlow(ctx, deps);
    return true;
  }

  if (normalizedCommand === "back") {
    await showPreviousLeadStep(ctx, deps, session);
    return true;
  }

  if (session.step === "quantity") {
    const result = deps.services.lead.saveQuantity({
      client: ctx.from,
      clientId: ctx.from.id,
      session,
      rawQuantity: ctx.message.text,
    });

    if (!result.ok) {
      await ctx.reply(result.error, quantityKeyboard());
      return true;
    }

    await showLeadStep(ctx, result.nextStep, result);
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

    await showLeadStep(ctx, result.nextStep, result);
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
      "Подтвердите заявку кнопкой ниже. Чтобы поправить данные, используйте кнопки «Изменить ...».",
      confirmLeadKeyboard(session.draft),
    );
    return true;
  }

  return false;
}

async function getLeadSessionOrReply(ctx, deps) {
  const session = deps.services.lead.getSession(ctx.from.id);
  if (!session) {
    await safeAnswerCbQuery(ctx, "Сессия не найдена");
    return null;
  }
  return session;
}

async function showConfirmOrContactStep(ctx, result) {
  const nextStep = result.nextStep === "confirm" ? "confirm" : "contact";
  await showLeadStep(ctx, nextStep, result);
}

function isUserBlocked(user) {
  return user && user.is_blocked;
}

async function rejectBlocked(ctx) {
  await ctx.reply("Ваш аккаунт заблокирован. Обратитесь к администратору.");
}

async function ensureClientAllowed(ctx, deps, { checkRateLimit = false } = {}) {
  if (checkRateLimit && !messageLimiter.isAllowed(ctx.from.id)) {
    await ctx.reply(rateLimitMessage());
    return false;
  }

  const user = deps.services.conversation.upsertTelegramUser(
    ctx.from,
    "client",
  );
  if (isUserBlocked(user)) {
    await rejectBlocked(ctx);
    return false;
  }

  return true;
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
}

async function handleClientHelp(ctx) {
  await ctx.reply(helpMessage(), backToMainKeyboard());
}

async function handleClientMenu(ctx, deps) {
  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  await showHomeScreen(ctx, deps, parseSourcePayload(sourcePayload));
}

async function handleClientMiniApp(ctx, deps) {
  await openMiniApp(ctx, deps);
}

async function handleClientStatus(ctx, deps) {
  if (!(await ensureClientAllowed(ctx, deps))) {
    return;
  }
  const lead = deps.repos.leads.getLatestByClient(ctx.from.id);
  await ctx.reply(clientLeadStatusMessage(lead), backToMainKeyboard());
}

async function handleClientText(ctx, deps) {
  if (!(await ensureClientAllowed(ctx, deps, { checkRateLimit: true }))) {
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

  if (action === ACTIONS.LEAD_RESUME) {
    await safeAnswerCbQuery(ctx);
    await showCurrentLeadStep(
      ctx,
      deps,
      deps.services.lead.getSession(ctx.from.id),
    );
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
    const draftState = deps.services.lead.startLeadDraft({
      clientId: ctx.from.id,
      product,
      sourcePayload,
    });

    await safeAnswerCbQuery(ctx);
    if (draftState.step === "quantity") {
      await showLeadStep(ctx, "quantity", { product });
      return;
    }
    await showCurrentLeadStep(
      ctx,
      deps,
      deps.services.lead.getSession(ctx.from.id),
    );
    return;
  }

  if (action === ACTIONS.LEAD_SKIP_COMMENT) {
    const session = await getLeadSessionOrReply(ctx, deps);
    if (!session) return;

    const result = deps.services.lead.skipComment({
      clientId: ctx.from.id,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showConfirmOrContactStep(ctx, result);
    return;
  }

  if (action === ACTIONS.LEAD_CONTACT_TELEGRAM) {
    const session = await getLeadSessionOrReply(ctx, deps);
    if (!session) return;

    const result = deps.services.lead.useTelegramContact({
      client: ctx.from,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "confirm", result);
    return;
  }

  if (action === ACTIONS.LEAD_CONTACT_CUSTOM) {
    const session = await getLeadSessionOrReply(ctx, deps);
    if (!session) return;

    deps.services.lead.requestCustomContact({
      clientId: ctx.from.id,
      session,
    });

    await safeAnswerCbQuery(ctx);
    await showLeadStep(ctx, "contact_custom");
    return;
  }

  if (
    action === ACTIONS.LEAD_EDIT_QUANTITY ||
    action === ACTIONS.LEAD_EDIT_COMMENT ||
    action === ACTIONS.LEAD_EDIT_CONTACT
  ) {
    const session = await getLeadSessionOrReply(ctx, deps);
    if (!session) return;

    const field =
      action === ACTIONS.LEAD_EDIT_QUANTITY
        ? "quantity"
        : action === ACTIONS.LEAD_EDIT_COMMENT
          ? "comment"
          : "contact";
    const result = deps.services.lead.startConfirmEdit({
      clientId: ctx.from.id,
      session,
      field,
    });
    if (!result.ok) {
      await safeAnswerCbQuery(ctx, "Не удалось изменить шаг");
      return;
    }

    await safeAnswerCbQuery(ctx);
    if (result.nextStep === "quantity") {
      const product = deps.services.lead.hydrateProductForLead(
        session.draft.productId,
      );
      await showLeadStep(ctx, "quantity", { product });
      return;
    }
    if (result.nextStep === "comment") {
      await showLeadStep(ctx, "comment");
      return;
    }
    await showLeadStep(ctx, "contact");
    return;
  }

  if (action === ACTIONS.LEAD_CONFIRM) {
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

  if (action === ACTIONS.LEAD_BACK) {
    const session = deps.services.lead.getSession(ctx.from.id);
    await safeAnswerCbQuery(ctx);
    await showPreviousLeadStep(ctx, deps, session);
    return;
  }

  if (action === ACTIONS.LEAD_CANCEL) {
    await safeAnswerCbQuery(ctx, "Заявка отменена");
    await cancelLeadFlow(ctx, deps);
  }
}

async function handleClientMedia(ctx, deps, mediaType) {
  if (!(await ensureClientAllowed(ctx, deps, { checkRateLimit: true }))) {
    return;
  }

  const sourcePayload = getCurrentSourcePayload(deps.repos, ctx.from.id);
  const conversation = deps.services.conversation.ensureConversation(
    ctx.from.id,
    sourcePayload,
  );

  let fileId;
  let caption = "";

  if (mediaType === "photo") {
    const photos = ctx.message.photo;
    fileId = photos[photos.length - 1].file_id;
    caption = ctx.message.caption || "";
  } else {
    fileId = ctx.message.document.file_id;
    caption = ctx.message.caption || "";
  }

  const messageData = JSON.stringify({ file_id: fileId, caption });
  deps.repos.messages.create(
    conversation.id,
    "client",
    ctx.from.id,
    messageData,
    mediaType,
  );
  deps.repos.leads.touchLastClientActivityByClient(ctx.from.id);

  const clientLabel = formatClientLabel(ctx.from, ctx.chat.id);
  const adminCaption = `${clientLabel}\n${caption || "(без подписи)"}`;

  try {
    if (mediaType === "photo") {
      await deps.bot.telegram.sendPhoto(deps.adminId, fileId, {
        caption: adminCaption,
      });
    } else {
      await deps.bot.telegram.sendDocument(deps.adminId, fileId, {
        caption: adminCaption,
      });
    }
  } catch {
    await deps.bot.telegram.sendMessage(
      deps.adminId,
      `${clientLabel} отправил(а) ${mediaType === "photo" ? "фото" : "документ"}, но не удалось переслать.`,
    );
  }

  await ctx.reply(clientMessageDelivered(), backToMainKeyboard());
}

module.exports = {
  handleClientStart,
  handleClientHelp,
  handleClientMenu,
  handleClientMiniApp,
  handleClientStatus,
  handleClientText,
  handleClientAction,
  handleClientMedia,
};
