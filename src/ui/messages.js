const { formatSourceLabel } = require("../utils/formatters");
const { getLeadStatusLabel } = require("../domain/lead-status");

function withFallback(value, fallback) {
  return value ? value : fallback;
}

function welcomeMessage(entry) {
  const tagline =
    "Оставьте заявку в пару шагов или сразу напишите менеджеру.";

  if (entry?.source === "channel") {
    return `${entry.title}.\n\n${tagline}`;
  }

  return `Здравствуйте! Мы можем найти для вас всё что угодно.\n\n${tagline}`;
}

function helpMessage() {
  return (
    "Команды бота:\n" +
    "/start — открыть стартовый экран\n" +
    "/menu — показать главное меню\n" +
    "/status — статус вашей последней заявки\n" +
    "/cancel — отменить текущую заявку\n" +
    "/help — справка\n\n" +
    "Также вы можете просто написать сообщение менеджеру или оформить заявку через меню."
  );
}

function howToOrderMessage() {
  return (
    "Как оформить заказ:\n" +
    '1. Откройте каталог или нажмите "Оставить заявку".\n' +
    "2. Выберите товар.\n" +
    "3. Укажите количество и комментарий.\n" +
    "4. Подтвердите заявку.\n\n" +
    "После этого администратор свяжется с вами в этом чате."
  );
}

function askQuantityMessage(product) {
  return (
    `Шаг 1 из 4.\n\nВы выбрали "${product.title}".\n` +
    "Укажите количество одним сообщением (целое число).\n" +
    "Например: 1, 5, 12."
  );
}

function askCommentMessage() {
  return (
    "Шаг 2 из 4.\n\n" +
    "Добавьте комментарий к заявке одним сообщением или оставьте заявку без комментария.\n" +
    "Если комментарий не нужен, нажмите «Оставить без комментария»."
  );
}

function askContactMessage() {
  return "Шаг 3 из 4.\n\nКак с вами удобнее связаться по заявке?";
}

function askCustomContactMessage() {
  return (
    "Шаг 3 из 4.\n\n" +
    "Напишите контакт для связи одним сообщением: @username, телефон или другой удобный способ."
  );
}

function leadSummaryMessage(draft) {
  const comment = withFallback(draft.comment, "Без комментария");
  const contact = withFallback(draft.contactLabel, "Ответить в этом чате");
  const source = formatSourceLabel(draft.sourcePayload);
  return (
    "Шаг 4 из 4.\n\nПроверьте заявку:\n\n" +
    `Товар: ${draft.productName}\n` +
    `Количество: ${draft.quantity}\n` +
    `Комментарий: ${comment}\n` +
    `Контакт: ${contact}\n` +
    `Источник: ${source}\n\n` +
    "Если всё верно, подтвердите заявку.\n" +
    "Нужно что-то поправить? Используйте кнопки «Изменить ...» ниже."
  );
}

function leadCreatedMessage() {
  return (
    "Заявка отправлена администратору.\n\n" +
    "Мы свяжемся с вами в этом чате. Пока можете вернуться в главное меню или написать дополнительное сообщение менеджеру."
  );
}

function contactManagerMessage() {
  return (
    "Напишите, что вас интересует — любой товар или услуга.\n\n" +
    "Мы подберём вариант и сообщим цену в ответном сообщении."
  );
}

function clientMessageDelivered() {
  return "Сообщение отправлено менеджеру. Ожидайте ответа.";
}

function adminSelectedClientMessage(clientId) {
  return (
    `Диалог с клиентом ${clientId} открыт.\n` +
    "Теперь можно отвечать текстом, использовать быстрые шаблоны или вернуться в inbox."
  );
}

function adminNoClientSelectedMessage() {
  return (
    "Сейчас ни один клиент не выбран.\n" +
    "Откройте диалог через кнопку под сообщением клиента, /dialogs или /setclient <id>."
  );
}

function adminClientCard(clientLabel, text, sourcePayload, msgCount = null) {
  const source = formatSourceLabel(sourcePayload);
  const countLine =
    msgCount !== null ? `Сообщений в диалоге: ${msgCount}\n` : "";
  return (
    "💬 Новое сообщение от клиента:\n" +
    `${clientLabel}\n` +
    `${source}\n` +
    `${countLine}\n` +
    `Текст:\n${text}`
  );
}

function adminLeadCard(lead, clientLabel) {
  const comment = withFallback(lead.comment, "Без комментария");
  const contact = withFallback(lead.contact_label, "Ответить в Telegram");
  const source = formatSourceLabel(lead.source_payload);
  return (
    "Новая заявка:\n" +
    `${clientLabel}\n\n` +
    `Товар: ${lead.product_name}\n` +
    `Количество: ${lead.quantity}\n` +
    `Комментарий: ${comment}\n` +
    `Контакт: ${contact}\n` +
    `Источник: ${source}\n` +
    `Статус: ${getLeadStatusLabel(lead.status)}`
  );
}

function clientReceivedAdminMessage(text) {
  return `Сообщение от администратора:\n\n${text}`;
}

function clientLeadTakenMessage() {
  return "Заявка взята в работу. Менеджер уже смотрит детали и скоро напишет вам.";
}

function clientLeadClosedMessage() {
  return "Заявка закрыта. Если понадобится ещё что-то, просто напишите в этот чат.";
}

function clientLeadOutOfStockMessage() {
  return "По этой заявке позиция сейчас недоступна. Если хотите, подберём альтернативу — просто ответьте в этот чат.";
}

function clientLeadNotRelevantMessage() {
  return "Заявка закрыта как неактуальная. Если запрос снова станет актуален, напишите нам в этот чат — быстро продолжим.";
}

function clientLeadCalledBackMessage() {
  return "Менеджер свяжется с вами в ближайшее время. Ожидайте звонка или сообщения!";
}

function clientLeadAwaitingPaymentMessage() {
  return "Ваша заявка подтверждена. Ожидаем оплату — реквизиты уже отправлены или будут высланы менеджером.";
}

function clientLeadFulfilledMessage() {
  return "Ваша заявка выполнена. Спасибо за покупку! Будем рады снова помочь 🎉";
}

function conversationResolvedMessage() {
  return "Ваш запрос обработан и закрыт. Если появятся новые вопросы — просто напишите, и мы снова на связи!";
}

function rateLimitMessage() {
  return "Вы отправляете сообщения слишком часто. Пожалуйста, подождите немного.";
}

function clientLeadStatusMessage(lead) {
  if (!lead) {
    return "У вас пока нет ни одной заявки. Оформить можно через главное меню.";
  }

  const statusLabel = getLeadStatusLabel(lead.status);
  const comment = withFallback(lead.comment, "Без комментария");
  const contact = withFallback(lead.contact_label, "Ответить в Telegram");
  const date = new Date(lead.created_at + "Z").toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    `Ваша последняя заявка #${lead.id}:\n\n` +
    `Товар: ${lead.product_name}\n` +
    `Количество: ${lead.quantity}\n` +
    `Комментарий: ${comment}\n` +
    `Контакт: ${contact}\n` +
    `Статус: ${statusLabel}\n` +
    `Дата: ${date}`
  );
}

module.exports = {
  conversationResolvedMessage,
  rateLimitMessage,
  welcomeMessage,
  helpMessage,
  howToOrderMessage,
  askQuantityMessage,
  askCommentMessage,
  askContactMessage,
  askCustomContactMessage,
  leadSummaryMessage,
  leadCreatedMessage,
  contactManagerMessage,
  clientMessageDelivered,
  adminSelectedClientMessage,
  adminNoClientSelectedMessage,
  adminClientCard,
  adminLeadCard,
  clientReceivedAdminMessage,
  clientLeadTakenMessage,
  clientLeadClosedMessage,
  clientLeadOutOfStockMessage,
  clientLeadNotRelevantMessage,
  clientLeadCalledBackMessage,
  clientLeadAwaitingPaymentMessage,
  clientLeadFulfilledMessage,
  clientLeadStatusMessage,
};
