const { Markup } = require("telegraf");

function backToMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Главное меню", "menu:main")],
  ]);
}

function catalogKeyboard(products) {
  const rows = products.map((product) => [
    Markup.button.callback(product.title, `catalog:product:${product.id}`),
  ]);

  rows.push([Markup.button.callback("Главное меню", "menu:main")]);
  return Markup.inlineKeyboard(rows);
}

function productCardKeyboard(productId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Оставить заявку на этот товар",
        `lead:product:${productId}`,
      ),
    ],
    [Markup.button.callback("Назад в каталог", "catalog:root")],
    [Markup.button.callback("Главное меню", "menu:main")],
  ]);
}

function quantityKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Назад", "lead:back"),
      Markup.button.callback("Отмена", "lead:cancel"),
    ],
    [Markup.button.callback("Главное меню", "menu:main")],
  ]);
}

function commentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Пропустить комментарий", "lead:skip_comment")],
    [
      Markup.button.callback("Назад", "lead:back"),
      Markup.button.callback("Отмена", "lead:cancel"),
    ],
  ]);
}

function contactKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Ответить в Telegram", "lead:contact_telegram")],
    [Markup.button.callback("Указать другой контакт", "lead:contact_custom")],
    [
      Markup.button.callback("Назад", "lead:back"),
      Markup.button.callback("Отмена", "lead:cancel"),
    ],
  ]);
}

function customContactKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Назад", "lead:back"),
      Markup.button.callback("Отмена", "lead:cancel"),
    ],
  ]);
}

function confirmLeadKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Подтвердить заявку", "lead:confirm")],
    [Markup.button.callback("Изменить контакт", "lead:back")],
    [Markup.button.callback("Главное меню", "menu:main")],
  ]);
}

function adminClientMessageKeyboard(clientId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Ответить", `admin:reply:${clientId}`),
      Markup.button.callback("Открыть диалог", `admin:dialog:${clientId}`),
    ],
  ]);
}

function adminLeadKeyboard(leadId, clientId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Открыть диалог", `admin:dialog:${clientId}`),
      Markup.button.callback("Взять в работу", `admin:lead_take:${leadId}`),
    ],
    [
      Markup.button.callback(
        "📞 Перезвонили",
        `admin:lead_called_back:${leadId}`,
      ),
      Markup.button.callback(
        "💳 Ждём оплату",
        `admin:lead_awaiting_payment:${leadId}`,
      ),
    ],
    [
      Markup.button.callback("✅ Выполнена", `admin:lead_fulfilled:${leadId}`),
      Markup.button.callback("Закрыть заявку", `admin:lead_close:${leadId}`),
    ],
    [Markup.button.callback("Inbox", "admin:inbox")],
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
      Markup.button.callback("Inbox", "admin:inbox"),
      Markup.button.callback("Сбросить диалог", "admin:clear_dialog"),
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
        `admin:dialog:${dialog.client_telegram_id}`,
      ),
    ]);

  rows.push([Markup.button.callback("Обновить inbox", "admin:inbox")]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
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
