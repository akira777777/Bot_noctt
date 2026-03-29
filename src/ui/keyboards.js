const { Markup } = require("telegraf");
const { ACTIONS, ACTION_PREFIXES, buildAction } = require("../utils/actions");
const { CATALOG_PAGE_SIZE } = require("./catalog-view");

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
  return catalogKeyboardPaged(products, 0, { cartItemCount: 0 });
}

function catalogKeyboardPaged(allProducts, page, options = {}) {
  const { cartItemCount = 0 } = options;
  const totalPages = Math.max(
    1,
    Math.ceil(allProducts.length / CATALOG_PAGE_SIZE),
  );
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = allProducts.slice(
    safePage * CATALOG_PAGE_SIZE,
    safePage * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE,
  );

  const rows = slice.map((product) => [
    Markup.button.callback(
      product.title,
      buildAction(ACTION_PREFIXES.CATALOG_PRODUCT, product.id),
    ),
  ]);

  if (totalPages > 1) {
    const nav = [];
    if (safePage > 0) {
      nav.push(
        Markup.button.callback(
          "◀",
          buildAction(ACTION_PREFIXES.CATALOG_PAGE, safePage - 1),
        ),
      );
    }
    if (safePage < totalPages - 1) {
      nav.push(
        Markup.button.callback(
          "▶",
          buildAction(ACTION_PREFIXES.CATALOG_PAGE, safePage + 1),
        ),
      );
    }
    if (nav.length) {
      rows.push(nav);
    }
  }

  if (cartItemCount > 0) {
    rows.push([
      Markup.button.callback(
        `Оформить корзину (${cartItemCount})`,
        ACTIONS.CART_CHECKOUT,
      ),
    ]);
  }

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
    [
      Markup.button.callback(
        "В корзину",
        buildAction(ACTION_PREFIXES.CART_ADD, productId),
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
    [
      Markup.button.callback(
        "Оставить без комментария",
        ACTIONS.LEAD_SKIP_COMMENT,
      ),
    ],
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
  ]);
}

function contactKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Ответить в Telegram",
        ACTIONS.LEAD_CONTACT_TELEGRAM,
      ),
    ],
    [
      Markup.button.callback(
        "Указать другой контакт",
        ACTIONS.LEAD_CONTACT_CUSTOM,
      ),
    ],
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

function confirmLeadKeyboard(draft = {}) {
  const commentButtonLabel = draft.comment
    ? "Изменить комментарий"
    : "Добавить комментарий";

  if (draft.items && draft.items.length) {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Подтвердить заявку", ACTIONS.LEAD_CONFIRM)],
      [
        Markup.button.callback("Изменить корзину", ACTIONS.LEAD_EDIT_QUANTITY),
        Markup.button.callback(commentButtonLabel, ACTIONS.LEAD_EDIT_COMMENT),
      ],
      [Markup.button.callback("Изменить контакт", ACTIONS.LEAD_EDIT_CONTACT)],
      [
        Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
        Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
      ],
      [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
    ]);
  }

  return Markup.inlineKeyboard([
    [Markup.button.callback("Подтвердить заявку", ACTIONS.LEAD_CONFIRM)],
    [
      Markup.button.callback("Изменить количество", ACTIONS.LEAD_EDIT_QUANTITY),
      Markup.button.callback(commentButtonLabel, ACTIONS.LEAD_EDIT_COMMENT),
    ],
    [Markup.button.callback("Изменить контакт", ACTIONS.LEAD_EDIT_CONTACT)],
    [
      Markup.button.callback("Назад", ACTIONS.LEAD_BACK),
      Markup.button.callback("Отмена", ACTIONS.LEAD_CANCEL),
    ],
    [Markup.button.callback("Главное меню", ACTIONS.MENU_MAIN)],
  ]);
}

function leadResumeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Продолжить заявку", ACTIONS.LEAD_RESUME)],
    [Markup.button.callback("Написать менеджеру", ACTIONS.CONTACT_MANAGER)],
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
        "Напомнить через 2ч",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_SNOOZE, leadId),
      ),
      Markup.button.callback(
        "Нет в наличии",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_OUT_OF_STOCK, leadId),
      ),
    ],
    [
      Markup.button.callback(
        "Неактуально",
        buildAction(ACTION_PREFIXES.ADMIN_LEAD_NOT_RELEVANT, leadId),
      ),
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
      Markup.button.callback("Подтвердить", `admin:template:ack:${clientId}`),
      Markup.button.callback("Сроки", `admin:template:terms:${clientId}`),
    ],
    [
      Markup.button.callback(
        "Наличие",
        `admin:template:availability:${clientId}`,
      ),
      Markup.button.callback("Контакт", `admin:template:contact:${clientId}`),
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

function adminInboxKeyboard(
  dialogs,
  { offset = 0, pageSize = 8, hasMore = false } = {},
) {
  const rows = dialogs
    .slice(0, pageSize)
    .map((dialog) => [
      Markup.button.callback(
        `Открыть ${_clientButtonLabel(dialog)}`,
        buildAction(ACTION_PREFIXES.ADMIN_DIALOG, dialog.client_telegram_id),
      ),
    ]);

  const nav = [];
  if (offset > 0) {
    nav.push(
      Markup.button.callback(
        "◀ Раньше",
        `${ACTION_PREFIXES.ADMIN_LIST}dialogs:${Math.max(0, offset - pageSize)}`,
      ),
    );
  }
  if (hasMore) {
    nav.push(
      Markup.button.callback(
        "Ещё ▶",
        `${ACTION_PREFIXES.ADMIN_LIST}dialogs:${offset + pageSize}`,
      ),
    );
  }
  if (nav.length) {
    rows.push(nav);
  }

  rows.push([Markup.button.callback("Обновить inbox", ACTIONS.ADMIN_INBOX)]);
  return Markup.inlineKeyboard(rows);
}

function adminListPaginationKeyboard(kind, offset, pageSize, hasMore) {
  const nav = [];
  if (offset > 0) {
    nav.push(
      Markup.button.callback(
        "◀ Раньше",
        `${ACTION_PREFIXES.ADMIN_LIST}${kind}:${Math.max(0, offset - pageSize)}`,
      ),
    );
  }
  if (hasMore) {
    nav.push(
      Markup.button.callback(
        "Ещё ▶",
        `${ACTION_PREFIXES.ADMIN_LIST}${kind}:${offset + pageSize}`,
      ),
    );
  }
  if (!nav.length) {
    return null;
  }
  return Markup.inlineKeyboard([nav]);
}

module.exports = {
  clientMiniAppKeyboard,
  backToMainKeyboard,
  catalogKeyboard,
  catalogKeyboardPaged,
  productCardKeyboard,
  quantityKeyboard,
  commentKeyboard,
  contactKeyboard,
  customContactKeyboard,
  confirmLeadKeyboard,
  leadResumeKeyboard,
  adminClientMessageKeyboard,
  adminLeadKeyboard,
  adminQuickReplyKeyboard,
  adminInboxKeyboard,
  adminListPaginationKeyboard,
};
