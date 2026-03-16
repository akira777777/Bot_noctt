const { adminLeadKeyboard } = require("../ui/keyboards");
const { adminLeadCard } = require("../ui/messages");
const { formatClientLabel } = require("../utils/formatters");
const { safeSendMessage } = require("../utils/telegram");

function createLeadService({
  db,
  repos,
  bot,
  adminId,
  catalogService,
  conversationService,
}) {
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

  function moveToStep(clientId, nextStep, session, patch = {}) {
    const draft = buildDraft(session, patch);
    repos.sessions.set(clientId, "lead", nextStep, draft);

    return {
      ok: true,
      nextStep,
      draft,
    };
  }

  function startLeadDraft({ clientId, product, sourcePayload }) {
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
    return draft;
  }

  function saveQuantity({ clientId, session, rawQuantity }) {
    const quantity = Number(rawQuantity.trim());
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        error: "Количество должно быть положительным числом.",
      };
    }

    return moveToStep(clientId, "comment", session, { quantity });
  }

  function saveComment({ clientId, session, comment }) {
    const trimmed = comment.trim();
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
    return moveToStep(clientId, "contact", session, {
      comment: trimmed,
    });
  }

  function skipComment({ clientId, session }) {
    return moveToStep(clientId, "contact", session, { comment: "" });
  }

  function useTelegramContact({ client, session }) {
    const contactLabel = client.username
      ? `Telegram: @${client.username}`
      : `Telegram: id ${client.id}`;
    return moveToStep(client.id, "confirm", session, { contactLabel });
  }

  function requestCustomContact({ clientId, session }) {
    const draft = session?.draft || {};
    repos.sessions.set(clientId, "lead", "contact_custom", draft);

    return {
      ok: true,
      nextStep: "contact_custom",
      draft,
    };
  }

  function saveCustomContact({ clientId, session, contactText }) {
    const value = contactText.trim();
    if (!value) {
      return { ok: false, error: "Укажите контакт одним сообщением." };
    }
    if (value.length > 500) {
      return { ok: false, error: "Контакт не должен превышать 500 символов." };
    }

    return moveToStep(clientId, "confirm", session, { contactLabel: value });
  }

  function goBack(clientId, session) {
    if (!session) {
      return null;
    }

    switch (session.step) {
      case "comment":
        repos.sessions.set(clientId, "lead", "quantity", session.draft);
        return "quantity";
      case "contact":
        repos.sessions.set(clientId, "lead", "comment", session.draft);
        return "comment";
      case "contact_custom":
      case "confirm":
        repos.sessions.set(clientId, "lead", "contact", session.draft);
        return "contact";
      default:
        return null;
    }
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

    const existingLead = repos.leads.getOpenByClientAndProduct(
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

      repos.sessions.clear(client.id);
      return result;
    });

    const lead = transaction();
    try {
      await notifyAdminAboutLead(lead, client, chatId);
    } catch (err) {
      console.warn(
        `[lead-service] notifyAdminAboutLead failed for lead #${lead.id}:`,
        err.message,
      );
    }

    return lead;
  }

  function hydrateProductForLead(productId) {
    return catalogService.getProductById(productId);
  }

  return {
    getSession,
    clearSession,
    startLeadDraft,
    saveQuantity,
    saveComment,
    skipComment,
    useTelegramContact,
    requestCustomContact,
    saveCustomContact,
    goBack,
    confirmLead,
    hydrateProductForLead,
  };
}

module.exports = {
  createLeadService,
};
