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
  return `• ${name} — id ${conversation.client_telegram_id} — ${conversation.status} — ${source} — ${lastText}`;
}

function formatLeadRow(lead) {
  const name = getUserDisplayName(lead);
  const source = formatSourceLabel(lead.source_payload);
  const statusLabel = getLeadStatusLabel(lead.status);
  return `• #${lead.id} ${lead.product_name} x${lead.quantity} — ${name} — ${statusLabel} — ${source}`;
}

module.exports = {
  getUserDisplayName,
  formatSourceLabel,
  formatClientLabel,
  formatConversationRow,
  formatLeadRow,
};
