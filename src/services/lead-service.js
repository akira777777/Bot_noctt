const { adminLeadKeyboard } = require("../ui/keyboards");
const { adminLeadCard } = require("../ui/messages");
const { formatClientLabel } = require("../utils/formatters");
const { safeSendMessage } = require("../utils/telegram");
const { logError } = require("../utils/logger");

function createLeadService({
  db,
  repos,
  bot,
  adminId,
  catalogService,
  conversationService,
}) {
  const CART_PRODUCT_CODE = "__cart__";

  const EDITABLE_CONFIRM_STEPS = Object.freeze({
    quantity: "quantity",
    comment: "comment",
    contact: "contact",
  });

  const CART_BACK_TRANSITIONS = Object.freeze({
    line_qty: "catalog",
    comment: "catalog",
    contact: "comment",
    contact_custom: "contact",
    confirm: "contact",
  });

  const BACK_TRANSITIONS = Object.freeze({
    comment: "confirm",
    contact: "confirm",
    contact_custom: "contact",
    confirm: "quantity",
  });

  function isConfirmEditing(session) {
    return Boolean(session?.draft?.isConfirmEditing);
  }

  function getNextStep(session, regularStep) {
    return isConfirmEditing(session) ? "confirm" : regularStep;
  }

  function getSession(clientId) {
    return repos.sessions.get(clientId);
  }

  function clearSession(clientId) {
    repos.sessions.clear(clientId);
  }

  function buildDraft(session, patch) {
    return {
      ...(session?.draft || {}),
      ...patch,
    };
  }

  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function moveToStep(clientId, nextStep, session, patch = {}) {
    const draft = buildDraft(session, patch);
    repos.sessions.set(clientId, "lead", nextStep, draft);

    return {
      ok: true,
      nextStep,
      draft,
    };
  }

  function moveCartStep(clientId, nextStep, session, patch = {}) {
    const draft = buildDraft(session, patch);
    repos.sessions.set(clientId, "cart", nextStep, draft);
    return {
      ok: true,
      nextStep,
      draft,
    };
  }

  function parsePositiveQuantity(rawQuantity) {
    const quantityText = normalizeText(rawQuantity);
    const quantity = Number(quantityText);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        error:
          "Количество должно быть целым положительным числом. Пример: 1, 5, 12.",
      };
    }
    if (quantity > 10000) {
      return {
        ok: false,
        error: "Слишком большое количество. Укажите значение до 10000.",
      };
    }
    return { ok: true, quantity };
  }

  function buildTelegramContactLabel(client, clientId) {
    if (client?.username) {
      return `Telegram: @${client.username}`;
    }
    return `Telegram: id ${client?.id || clientId}`;
  }

  function recordLeadEvent(payload) {
    if (!repos.leadEvents) {
      return;
    }
    if (
      Number.isInteger(payload?.clientTelegramId) &&
      repos.users &&
      typeof repos.users.getById === "function" &&
      !repos.users.getById(payload.clientTelegramId)
    ) {
      return;
    }
    try {
      repos.leadEvents.create(payload);
    } catch (error) {
      logError("Failed to persist lead event", error);
    }
  }

  function startLeadDraft({ clientId, product, sourcePayload }) {
    const existingSession = repos.sessions.get(clientId);
    if (
      existingSession?.flow === "lead" &&
      existingSession?.draft?.productId === product.id
    ) {
      const draft = {
        ...existingSession.draft,
        sourcePayload:
          existingSession.draft.sourcePayload || sourcePayload || null,
      };
      repos.sessions.set(clientId, "lead", existingSession.step, draft);
      return {
        resumed: true,
        step: existingSession.step,
        draft,
      };
    }

    const draft = {
      productId: product.id,
      productCode: product.code,
      productName: product.title,
      quantity: null,
      comment: "",
      contactLabel: "",
      sourcePayload: sourcePayload || null,
    };

    repos.sessions.set(clientId, "lead", "quantity", draft);
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "lead_flow_started",
      sourcePayload: draft.sourcePayload,
      metadata: {
        product_code: draft.productCode,
        product_name: draft.productName,
      },
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "product_selected",
      sourcePayload: draft.sourcePayload,
      metadata: {
        product_code: draft.productCode,
        product_name: draft.productName,
      },
    });
    return {
      resumed: false,
      step: "quantity",
      draft,
    };
  }

  function getOpenLeadByClientAndProduct(clientId, productCode) {
    return repos.leads.getOpenByClientAndProduct(clientId, productCode);
  }

  function isOpenLeadUniqueViolation(error) {
    return (
      typeof error?.message === "string" &&
      error.message.includes("idx_leads_unique_open_client_product")
    );
  }

  function saveQuantity({ client, clientId, session, rawQuantity }) {
    const parsed = parsePositiveQuantity(rawQuantity);
    if (!parsed.ok) {
      return parsed;
    }
    const { quantity } = parsed;

    const nextStep = "confirm";
    const result = moveToStep(clientId, nextStep, session, {
      quantity,
      contactLabel:
        session?.draft?.contactLabel ||
        buildTelegramContactLabel(client, clientId),
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "quantity_submitted",
      sourcePayload: result.draft.sourcePayload || null,
      metadata: {
        quantity,
        product_code: result.draft.productCode,
      },
    });
    return result;
  }

  function saveComment({ clientId, session, comment }) {
    const trimmed = normalizeText(comment);
    // Validate: non-empty after trim, max 500 chars
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: "Комментарий не может быть пустым.",
      };
    }
    if (trimmed.length > 500) {
      return {
        ok: false,
        error: "Комментарий не должен превышать 500 символов.",
      };
    }
    const nextStep = "confirm";
    const result = moveToStep(clientId, nextStep, session, {
      comment: trimmed,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "comment_added",
      sourcePayload: result.draft.sourcePayload || null,
    });
    return result;
  }

  function skipComment({ clientId, session }) {
    const nextStep = "confirm";
    const result = moveToStep(clientId, nextStep, session, {
      comment: "",
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "comment_skipped",
      sourcePayload: result.draft.sourcePayload || null,
    });
    return result;
  }

  function useTelegramContact({ client, session }) {
    const contactLabel = buildTelegramContactLabel(client, client.id);
    const result = moveToStep(client.id, "confirm", session, {
      contactLabel,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: client.id,
      eventType: "contact_confirmed",
      sourcePayload: result.draft.sourcePayload || null,
      metadata: { via: "telegram" },
    });
    return result;
  }

  function requestCustomContact({ clientId, session }) {
    return moveToStep(clientId, "contact_custom", session);
  }

  function saveCustomContact({ clientId, session, contactText }) {
    const value = normalizeText(contactText);
    if (!value) {
      return {
        ok: false,
        error:
          "Укажите контакт одним сообщением: @username, телефон или любой удобный способ связи.",
      };
    }
    if (value.length > 500) {
      return { ok: false, error: "Контакт не должен превышать 500 символов." };
    }

    const result = moveToStep(clientId, "confirm", session, {
      contactLabel: value,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "contact_confirmed",
      sourcePayload: result.draft.sourcePayload || null,
      metadata: { via: "custom" },
    });
    return result;
  }

  function startCartAddProduct({ clientId, product, sourcePayload }) {
    const existingSession = repos.sessions.get(clientId);
    if (existingSession?.flow === "lead") {
      return {
        ok: false,
        error:
          "Сначала завершите или отмените заявку на один товар (кнопка «Отмена»).",
      };
    }

    const baseDraft =
      existingSession?.flow === "cart" &&
      Array.isArray(existingSession.draft?.items)
        ? { ...existingSession.draft }
        : {
            items: [],
            comment: "",
            contactLabel: "",
            sourcePayload: sourcePayload || null,
            catalogPage: 0,
          };

    baseDraft.pendingProductId = product.id;
    baseDraft.pendingProductCode = product.code;
    baseDraft.pendingProductName = product.title;
    baseDraft.sourcePayload = baseDraft.sourcePayload || sourcePayload || null;

    repos.sessions.set(clientId, "cart", "line_qty", baseDraft);
    return { ok: true, step: "line_qty", draft: baseDraft };
  }

  function saveCartLineQuantity({ client, clientId, session, rawQuantity }) {
    const parsed = parsePositiveQuantity(rawQuantity);
    if (!parsed.ok) {
      return parsed;
    }
    const { quantity } = parsed;
    const pendingId = session?.draft?.pendingProductId;
    const code = session?.draft?.pendingProductCode;
    const name = session?.draft?.pendingProductName;
    if (!pendingId || !code || !name) {
      return { ok: false, error: "Сессия устарела. Откройте каталог снова." };
    }

    const items = Array.isArray(session.draft.items)
      ? session.draft.items.map((row) => ({ ...row }))
      : [];
    const idx = items.findIndex((row) => row.productCode === code);
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        quantity: items[idx].quantity + quantity,
      };
    } else {
      items.push({
        productId: pendingId,
        productCode: code,
        productName: name,
        quantity,
      });
    }

    const result = moveCartStep(clientId, "catalog", session, {
      items,
      pendingProductId: null,
      pendingProductCode: null,
      pendingProductName: null,
      contactLabel:
        session?.draft?.contactLabel ||
        buildTelegramContactLabel(client, clientId),
      isConfirmEditing: false,
    });
    return result;
  }

  function startCartCheckout(clientId) {
    const session = repos.sessions.get(clientId);
    if (!session || session.flow !== "cart") {
      return { ok: false, error: "Корзина не активна." };
    }
    const items = session.draft?.items || [];
    if (!items.length) {
      return { ok: false, error: "Добавьте хотя бы одну позицию в корзину." };
    }
    return moveCartStep(clientId, "comment", session, {
      isConfirmEditing: false,
    });
  }

  function saveCartComment({ clientId, session, comment }) {
    const trimmed = normalizeText(comment);
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: "Комментарий не может быть пустым.",
      };
    }
    if (trimmed.length > 500) {
      return {
        ok: false,
        error: "Комментарий не должен превышать 500 символов.",
      };
    }
    const result = moveCartStep(clientId, "confirm", session, {
      comment: trimmed,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "comment_added",
      sourcePayload: result.draft.sourcePayload || null,
    });
    return result;
  }

  function skipCartComment({ clientId, session }) {
    const result = moveCartStep(clientId, "confirm", session, {
      comment: "",
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "comment_skipped",
      sourcePayload: result.draft.sourcePayload || null,
    });
    return result;
  }

  function useTelegramContactCart({ client, session }) {
    const contactLabel = buildTelegramContactLabel(client, client.id);
    const result = moveCartStep(client.id, "confirm", session, {
      contactLabel,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: client.id,
      eventType: "contact_confirmed",
      sourcePayload: result.draft.sourcePayload || null,
      metadata: { via: "telegram" },
    });
    return result;
  }

  function requestCustomContactCart({ clientId, session }) {
    return moveCartStep(clientId, "contact_custom", session);
  }

  function saveCustomContactCart({ clientId, session, contactText }) {
    const value = normalizeText(contactText);
    if (!value) {
      return {
        ok: false,
        error:
          "Укажите контакт одним сообщением: @username, телефон или любой удобный способ связи.",
      };
    }
    if (value.length > 500) {
      return { ok: false, error: "Контакт не должен превышать 500 символов." };
    }
    const result = moveCartStep(clientId, "confirm", session, {
      contactLabel: value,
      isConfirmEditing: false,
    });
    recordLeadEvent({
      leadId: null,
      clientTelegramId: clientId,
      eventType: "contact_confirmed",
      sourcePayload: result.draft.sourcePayload || null,
      metadata: { via: "custom" },
    });
    return result;
  }

  function cancelLeadDraft(clientId) {
    const session = repos.sessions.get(clientId);
    if (session?.flow === "lead" || session?.flow === "cart") {
      recordLeadEvent({
        leadId: null,
        clientTelegramId: clientId,
        eventType: "lead_cancelled",
        sourcePayload: session.draft?.sourcePayload || null,
      });
    }
    repos.sessions.clear(clientId);
  }

  function startConfirmEdit({ clientId, session, field }) {
    if (!session || session.flow !== "lead" || session.step !== "confirm") {
      return { ok: false };
    }

    const targetStep = EDITABLE_CONFIRM_STEPS[field] || null;

    if (!targetStep) {
      return { ok: false };
    }

    repos.sessions.set(clientId, "lead", targetStep, {
      ...session.draft,
      isConfirmEditing: true,
    });

    return { ok: true, nextStep: targetStep };
  }

  function startCartConfirmEdit({ clientId, session, field }) {
    if (!session || session.flow !== "cart" || session.step !== "confirm") {
      return { ok: false };
    }
    if (field === "quantity") {
      repos.sessions.set(clientId, "cart", "catalog", {
        ...session.draft,
        isConfirmEditing: true,
      });
      return { ok: true, nextStep: "catalog" };
    }
    if (field === "comment") {
      repos.sessions.set(clientId, "cart", "comment", {
        ...session.draft,
        isConfirmEditing: true,
      });
      return { ok: true, nextStep: "comment" };
    }
    if (field === "contact") {
      repos.sessions.set(clientId, "cart", "contact", {
        ...session.draft,
        isConfirmEditing: true,
      });
      return { ok: true, nextStep: "contact" };
    }
    return { ok: false };
  }

  function goBackCart(clientId, session) {
    if (session.step === "line_qty") {
      const draft = {
        ...session.draft,
        pendingProductId: null,
        pendingProductCode: null,
        pendingProductName: null,
      };
      repos.sessions.set(clientId, "cart", "catalog", draft);
      return "catalog";
    }
    const previousStep = CART_BACK_TRANSITIONS[session.step];
    if (!previousStep) {
      return null;
    }
    repos.sessions.set(clientId, "cart", previousStep, session.draft);
    return previousStep;
  }

  function goBack(clientId, session) {
    if (!session) {
      return null;
    }
    if (session.flow === "cart") {
      return goBackCart(clientId, session);
    }
    const previousStep =
      session.step === "comment" && !isConfirmEditing(session)
        ? "quantity"
        : BACK_TRANSITIONS[session.step];
    if (!previousStep) {
      return null;
    }
    repos.sessions.set(clientId, "lead", previousStep, session.draft);
    return previousStep;
  }

  async function notifyAdminAboutLead(lead, client, chatId) {
    const clientLabel = formatClientLabel(client, chatId);
    await safeSendMessage(
      bot,
      adminId,
      adminLeadCard(lead, clientLabel),
      adminLeadKeyboard(lead.id, client.id),
    );
  }

  async function confirmLead({ client, chatId }) {
    const session = repos.sessions.get(client.id);
    if (!session || session.flow !== "lead" || session.step !== "confirm") {
      return null;
    }

    const existingLead = getOpenLeadByClientAndProduct(
      client.id,
      session.draft.productCode,
    );
    if (existingLead) {
      return { duplicate: true, existingLead };
    }

    const transaction = db.transaction(() => {
      const conversation = conversationService.ensureConversation(
        client.id,
        session.draft.sourcePayload || null,
      );
      const result = repos.leads.create({
        client_telegram_id: client.id,
        product_code: session.draft.productCode,
        product_name: session.draft.productName,
        quantity: session.draft.quantity,
        comment: session.draft.comment || "",
        contact_label: session.draft.contactLabel || "",
        source_payload: session.draft.sourcePayload || null,
        status: "new",
      });

      repos.messages.create(
        conversation.id,
        "system",
        client.id,
        `Создана заявка #${result.id}: ${result.product_name} x${result.quantity}`,
      );

      recordLeadEvent({
        leadId: result.id,
        clientTelegramId: client.id,
        eventType: "lead_confirmed",
        sourcePayload: session.draft.sourcePayload || null,
        metadata: {
          product_code: result.product_code,
          quantity: result.quantity,
        },
      });

      repos.sessions.clear(client.id);
      return result;
    });

    let lead;
    try {
      lead = transaction();
    } catch (error) {
      if (isOpenLeadUniqueViolation(error)) {
        const duplicate = getOpenLeadByClientAndProduct(
          client.id,
          session.draft.productCode,
        );
        return { duplicate: true, existingLead: duplicate };
      }
      throw error;
    }
    try {
      await notifyAdminAboutLead(lead, client, chatId);
    } catch (err) {
      logError(`notifyAdminAboutLead failed for lead #${lead.id}`, err);
    }

    return lead;
  }

  async function confirmCartLead({ client, chatId }) {
    const session = repos.sessions.get(client.id);
    if (!session || session.flow !== "cart" || session.step !== "confirm") {
      return null;
    }

    const items = session.draft?.items || [];
    if (!items.length) {
      return null;
    }

    const existingLead = getOpenLeadByClientAndProduct(
      client.id,
      CART_PRODUCT_CODE,
    );
    if (existingLead) {
      return { duplicate: true, existingLead };
    }

    const totalQty = items.reduce((sum, row) => sum + row.quantity, 0);
    const lineItemsJson = JSON.stringify(items);

    const transaction = db.transaction(() => {
      const conversation = conversationService.ensureConversation(
        client.id,
        session.draft.sourcePayload || null,
      );
      const result = repos.leads.create({
        client_telegram_id: client.id,
        product_code: CART_PRODUCT_CODE,
        product_name: `Корзина (${items.length} поз.)`,
        quantity: totalQty,
        comment: session.draft.comment || "",
        contact_label: session.draft.contactLabel || "",
        source_payload: session.draft.sourcePayload || null,
        status: "new",
        line_items_json: lineItemsJson,
      });

      repos.messages.create(
        conversation.id,
        "system",
        client.id,
        `Создана заявка #${result.id}: корзина (${items.length} поз.)`,
      );

      recordLeadEvent({
        leadId: result.id,
        clientTelegramId: client.id,
        eventType: "lead_confirmed",
        sourcePayload: session.draft.sourcePayload || null,
        metadata: {
          product_code: CART_PRODUCT_CODE,
          line_count: items.length,
          quantity: totalQty,
        },
      });

      repos.sessions.clear(client.id);
      return result;
    });

    let lead;
    try {
      lead = transaction();
    } catch (error) {
      if (isOpenLeadUniqueViolation(error)) {
        const duplicate = getOpenLeadByClientAndProduct(
          client.id,
          CART_PRODUCT_CODE,
        );
        return { duplicate: true, existingLead: duplicate };
      }
      throw error;
    }
    try {
      await notifyAdminAboutLead(lead, client, chatId);
    } catch (err) {
      logError(`notifyAdminAboutLead failed for lead #${lead.id}`, err);
    }

    return lead;
  }

  function updateCartCatalogPage(clientId, page) {
    const session = repos.sessions.get(clientId);
    if (!session || session.flow !== "cart") {
      return { ok: false };
    }
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    repos.sessions.set(clientId, "cart", session.step, {
      ...session.draft,
      catalogPage: safePage,
    });
    return { ok: true };
  }

  function hydrateProductForLead(productId) {
    return catalogService.getProductById(productId);
  }

  return {
    getSession,
    clearSession,
    cancelLeadDraft,
    startLeadDraft,
    saveQuantity,
    saveComment,
    skipComment,
    useTelegramContact,
    requestCustomContact,
    saveCustomContact,
    startConfirmEdit,
    goBack,
    confirmLead,
    confirmCartLead,
    startCartAddProduct,
    saveCartLineQuantity,
    startCartCheckout,
    saveCartComment,
    skipCartComment,
    useTelegramContactCart,
    requestCustomContactCart,
    saveCustomContactCart,
    startCartConfirmEdit,
    updateCartCatalogPage,
    hydrateProductForLead,
  };
}

module.exports = {
  createLeadService,
};
