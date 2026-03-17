const { formatSourceLabel } = require("../utils/formatters");
const { getLeadStatusLabel } = require("../domain/lead-status");

function welcomeMessage(entry) {
  if (entry?.source === "channel") {
    return (
      `${entry.title}.\n\n` +
      "Здесь можно быстро открыть каталог, оставить заявку или сразу написать менеджеру."
    );
  }

  return "Здравствуйте. Это бот для заявок, каталога и связи с менеджером.";
}

function helpMessage() {
  return (
    "Команды бота:\n" +
    "/start — открыть стартовый экран\n" +
    "/menu — показать главное меню\n" +
    "/status — статус вашей последней заявки\n" +
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
  return `Шаг 1 из 4.\n\nВы выбрали "${product.title}".\nУкажите количество одним сообщением цифрой.`;
}

function askCommentMessage() {
  return "Шаг 2 из 4.\n\nДобавьте комментарий к заявке одним сообщением или пропустите этот шаг.";
}

function askContactMessage() {
  return "Шаг 3 из 4.\n\nКак с вами удобнее связаться по заявке?";
}

function askCustomContactMessage() {
  return "Шаг 3 из 4.\n\nНапишите контакт для связи: @username, телефон или другой удобный способ.";
}

function leadSummaryMessage(draft) {
  const comment = draft.comment ? draft.comment : "Без комментария";
  const contact = draft.contactLabel
    ? draft.contactLabel
    : "Ответить в этом чате";
  const source = formatSourceLabel(draft.sourcePayload);
  return (
    "Шаг 4 из 4.\n\nПроверьте заявку:\n\n" +
    `Товар: ${draft.productName}\n` +
    `Количество: ${draft.quantity}\n` +
    `Комментарий: ${comment}\n` +
    `Контакт: ${contact}\n` +
    `Источник: ${source}\n\n` +
    "Если всё верно, подтвердите заявку."
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
    "Вы в режиме связи с менеджером.\n" +
    "Напишите сообщение, и администратор получит его в рабочем чате."
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

function adminClientCard(clientLabel, text, sourcePayload) {
  const source = formatSourceLabel(sourcePayload);
  return (
    "Новое сообщение от клиента:\n" +
    `${clientLabel}\n` +
    `${source}\n\n` +
    `Текст:\n${text}`
  );
}

function adminLeadCard(lead, clientLabel) {
  const comment = lead.comment ? lead.comment : "Без комментария";
  const contact = lead.contact_label
    ? lead.contact_label
    : "Ответить в Telegram";
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

function clientLeadCalledBackMessage() {
  return "Менеджер свяжется с вами в ближайшее время. Ожидайте звонка или сообщения!";
}

function clientLeadAwaitingPaymentMessage() {
  return "Ваша заявка подтверждена. Ожидаем оплату — реквизиты уже отправлены или будут высланы менеджером.";
}

function clientLeadFulfilledMessage() {
  return "Ваша заявка выполнена. Спасибо за покупку! Будем рады снова помочь 🎉";
}

function clientLeadStatusMessage(lead) {
  if (!lead) {
    return "У вас пока нет ни одной заявки. Оформить можно через главное меню.";
  }

  const statusLabel = getLeadStatusLabel(lead.status);
  const comment = lead.comment ? lead.comment : "Без комментария";
  const contact = lead.contact_label
    ? lead.contact_label
    : "Ответить в Telegram";
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
  clientLeadCalledBackMessage,
  clientLeadAwaitingPaymentMessage,
  clientLeadFulfilledMessage,
  clientLeadStatusMessage,
};
