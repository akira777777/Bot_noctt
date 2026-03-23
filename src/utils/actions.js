const ACTIONS = Object.freeze({
  MENU_MAIN: "menu:main",
  CATALOG_ROOT: "catalog:root",
  LEAD_START: "lead:start",
  CONTACT_MANAGER: "contact:manager",
  INFO_HOW_TO_ORDER: "info:how_to_order",
  LEAD_SKIP_COMMENT: "lead:skip_comment",
  LEAD_CONTACT_TELEGRAM: "lead:contact_telegram",
  LEAD_CONTACT_CUSTOM: "lead:contact_custom",
  LEAD_CONFIRM: "lead:confirm",
  LEAD_RESUME: "lead:resume",
  LEAD_BACK: "lead:back",
  LEAD_CANCEL: "lead:cancel",
  LEAD_EDIT_QUANTITY: "lead:edit_quantity",
  LEAD_EDIT_COMMENT: "lead:edit_comment",
  LEAD_EDIT_CONTACT: "lead:edit_contact",
  ADMIN_INBOX: "admin:inbox",
  ADMIN_NOOP: "admin:noop",
  ADMIN_CLEAR_DIALOG: "admin:clear_dialog",
});

const ACTION_PREFIXES = Object.freeze({
  CATALOG_PRODUCT: "catalog:product:",
  LEAD_PRODUCT: "lead:product:",
  ADMIN_REPLY: "admin:reply:",
  ADMIN_DIALOG: "admin:dialog:",
  ADMIN_LEAD_TAKE: "admin:lead_take:",
  ADMIN_LEAD_SNOOZE: "admin:lead_snooze:",
  ADMIN_LEAD_CLOSE: "admin:lead_close:",
  ADMIN_LEAD_OUT_OF_STOCK: "admin:lead_out_of_stock:",
  ADMIN_LEAD_NOT_RELEVANT: "admin:lead_not_relevant:",
  ADMIN_LEAD_CALLED_BACK: "admin:lead_called_back:",
  ADMIN_LEAD_AWAITING_PAYMENT: "admin:lead_awaiting_payment:",
  ADMIN_LEAD_FULFILLED: "admin:lead_fulfilled:",
  ADMIN_TEMPLATE: "admin:template:",
});

function buildAction(prefix, id) {
  return `${prefix}${id}`;
}

function parseActionId(action) {
  if (typeof action !== "string") {
    return NaN;
  }
  const parts = action.split(":");
  const idPart = parts[parts.length - 1];
  const parsed = Number(idPart);
  return Number.isFinite(parsed) ? parsed : NaN;
}

module.exports = {
  ACTIONS,
  ACTION_PREFIXES,
  buildAction,
  parseActionId,
};
