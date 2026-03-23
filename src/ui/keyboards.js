const { Markup } = require("telegraf");
const { ACTIONS, ACTION_PREFIXES, buildAction } = require("../utils/actions");

function backToMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function clientMiniAppKeyboard(webAppUrl) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp("📱 Открыть Mini App", webAppUrl)],
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function catalogKeyboard(products) {
  const rows = products.map((product) => [
    Markup.button.callback(
      product.title,
      buildAction(ACTION_PREFIXES.CATALOG_PRODUCT, product.id),
    ),
  ]);

  rows.push([Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)]);
  return Markup.inlineKeyboard(rows);
}

function productCardKeyboard(productId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Оставить заявку на этот товар",
        buildAction(ACTION_PREFIXES.LEAD_PRODUCT, productId),
      ),
    ],
    [Markup.button.callback("Назад в каталог", ACTIONS.CATALOG_ROOT)],
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function quantityKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function commentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Пропустить комментарий", ACTIONS.LEAD_SKIP_COMMENT)],
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
  ]);
}

function contactKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Ответить в Telegram", ACTIONS.LEAD_CONTACT_TELEGRAM)],
    [Markup.button.callback("Указать другой контакт", ACTIONS.LEAD_CONTACT_CUSTOM)],
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
  ]);
}

function customContactKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
  ]);
}

function confirmLeadKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Подтвердить заявку", ACTIONS.LEAD_CONFIRM)],
    [Markup.button.callback("Изменить контакт", ACTIONS.LEAD_BACK)],
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function adminClientMessageKeyboard(clientId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Ответить",
        buildAction(ACTION_PREFIXES.ADMIN_REPLY, clientId),
      ),
      Markup.button.callback(
        "Открыть диалог",
        buildAction(ACTION_PREFIXES.ADMIN_DIALOG, clientId),
      ),
    ],
  ]);
}

function adminLeadKeyboard(leadId, clientId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Открыть диалог",
        buildAction(ACTION_PREFIXES.ADMIN_DIALOG, clientId),
      ),
      Markup.button.callback(
        "Взять в работу",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_TAKE, leadId),
      ),
    ],
    [
      Markup.button.callback(
        "📞 Перезвонили",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_CALLED_BACK, leadId),
      ),
      Markup.button.callback(
        "💳 Ждём оплату",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_AWAITING_PAYMENT, leadId),
      ),
    ],
    [
      Markup.button.callback(
        "✅ Выполнена",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_FULFILLED, leadId),
      ),
      Markup.button.callback(
        "Закрыть заявку",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_CLOSE, leadId),
      ),
    ],
    [Markup.button.callback("Inbox", ACTIONS.ADMIN_INBOX)],
  ]);
}

function adminQuickReplyKeyboard(clientId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Цена", `admin:template:price:${clientId}`),
      Markup.button.callback("Сроки", `admin:template:terms:${clientId}`),
    ],
    [
      Markup.button.callback("Оплата", `admin:template:payment:${clientId}`),
      Markup.button.callback("Доставка", `admin:template:delivery:${clientId}`),
    ],
    [
      Markup.button.callback("Inbox", ACTIONS.ADMIN_INBOX),
      Markup.button.callback("Сбросить диалог", ACTIONS.ADMIN_CLEAR_DIALOG),
    ],
  ]);
}

function _clientButtonLabel(dialog) {
  if (dialog.username) return `@${dialog.username}`;
  if (dialog.first_name) {
    return dialog.last_name
      ? `${dialog.first_name} ${dialog.last_name}`
      : dialog.first_name;
  }
  return `id:${dialog.client_telegram_id}`;
}

function adminInboxKeyboard(dialogs) {
  const rows = dialogs
    .slice(0, 8)
    .map((dialog) => [
      Markup.button.callback(
        `Открыть ${_clientButtonLabel(dialog)}`,
        buildAction(ACTION_PREFIXES.ADMIN_DIALOG, dialog.client_telegram_id),
      ),
    ]);

  rows.push([Markup.button.callback("Обновить inbox", ACTIONS.ADMIN_INBOX)]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  clientMiniAppKeyboard,
  backToMainKeyboard,
  catalogKeyboard,
  productCardKeyboard,
  quantityKeyboard,
  commentKeyboard,
  contactKeyboard,
  customContactKeyboard,
  confirmLeadKeyboard,
  adminClientMessageKeyboard,
  adminLeadKeyboard,
  adminQuickReplyKeyboard,
  adminInboxKeyboard,
};
