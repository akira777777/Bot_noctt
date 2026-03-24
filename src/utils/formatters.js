const { getLeadStatusLabel } = require("../domain/lead-status");

function getUserDisplayName(user) {
  if (!user) {
    return "Неизвестный пользователь";
  }

  if (user.username) {
    return `@${user.username}`;
  }

  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    fullName ||
    `Пользователь ${user.telegram_id || user.client_telegram_id || user.id}`
  );
}

function formatSourceLabel(sourcePayload) {
  if (!sourcePayload) {
    return "Прямой вход";
  }

  const map = {
    from_channel: "Канал: общий вход",
    quote_channel: "Канал: заявка",
    support_channel: "Канал: поддержка",
    catalog_channel: "Канал: каталог",
  };

  return map[sourcePayload] || `Источник: ${sourcePayload}`;
}

function formatClientLabel(user, chatId) {
  const name = getUserDisplayName(user);
  const userId = user.telegram_id || user.client_telegram_id || user.id;
  return `${name} (id: ${userId}, chat: ${chatId})`;
}

function formatConversationRow(conversation) {
  const name = getUserDisplayName(conversation);
  const lastText = conversation.last_message_text
    ? conversation.last_message_text.slice(0, 60)
    : "Без сообщений";
  const source = formatSourceLabel(conversation.source_payload);
  const status = conversation.lead_status || conversation.status;
  const statusLabel = status
    ? getLeadStatusLabel(status)
    : "Без активной заявки";
  const productLabel = conversation.product_name
    ? ` — ${conversation.product_name}`
    : "";
  return `• ${name} — id ${conversation.client_telegram_id} — ${statusLabel}${productLabel} — ${source} — ${lastText}`;
}

function formatLineItemsShort(lead) {
  if (!lead?.line_items_json) {
    return null;
  }
  try {
    const arr = JSON.parse(lead.line_items_json);
    if (!Array.isArray(arr) || !arr.length) {
      return null;
    }
    return arr.map((i) => `${i.productName}×${i.quantity}`).join(", ");
  } catch {
    return null;
  }
}

function formatLeadRow(lead) {
  const name = getUserDisplayName(lead);
  const source = formatSourceLabel(lead.source_payload);
  const statusLabel = getLeadStatusLabel(lead.status);
  const cartSummary = formatLineItemsShort(lead);
  const productPart = cartSummary
    ? `Корзина (${cartSummary})`
    : `${lead.product_name} x${lead.quantity}`;
  return `• #${lead.id} ${productPart} — ${name} — ${statusLabel} — ${source}`;
}

module.exports = {
  getUserDisplayName,
  formatSourceLabel,
  formatClientLabel,
  formatConversationRow,
  formatLeadRow,
};
