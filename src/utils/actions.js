function parseActionId(action) {
  return Number(action.split(":")[2]);
}

module.exports = {
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
  LEAD_BACK: "lead:back",
  LEAD_CANCEL: "lead:cancel",
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
  ADMIN_LEAD_CLOSE: "admin:lead_close:",
  ADMIN_LEAD_CALLED_BACK: "admin:lead_called_back:",
  ADMIN_LEAD_AWAITING_PAYMENT: "admin:lead_awaiting_payment:",
  ADMIN_LEAD_FULFILLED: "admin:lead_fulfilled:",
  ADMIN_TEMPLATE: "admin:template:",
});

function buildAction(prefix, id) {
  return `${prefix}${id}`;
}

function parseActionId(action, prefix) {
  if (typeof action !== "string" || typeof prefix !== "string") {
    return { ok: false, error: "INVALID_ARGUMENTS" };
  }
  if (!action.startsWith(prefix)) {
    return { ok: false, error: "INVALID_PREFIX" };
  }
  const rawId = action.slice(prefix.length);
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "INVALID_ID" };
  }
  return { ok: true, id };
}

module.exports = {
  ACTIONS,
  ACTION_PREFIXES,
  buildAction,
  parseActionId,
};
