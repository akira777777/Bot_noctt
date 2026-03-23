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
  ADMIN_LEAD_CLOSE: "admin:lead_close:",
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
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "7f4ee9",
      },
      body: JSON.stringify({
        sessionId: "7f4ee9",
        runId: "initial",
        hypothesisId: "H2",
        location: "src/utils/actions.js:40",
        message: "parseActionId received non-string action",
        data: { actionType: typeof action },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NaN;
  }
  const parts = action.split(":");
  const parsed = Number(parts[2]);
  // #region agent log
  fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "7f4ee9",
    },
    body: JSON.stringify({
      sessionId: "7f4ee9",
      runId: "initial",
      hypothesisId: "H1",
      location: "src/utils/actions.js:45",
      message: "parseActionId parsed callback payload",
      data: {
        action,
        partsLength: parts.length,
        parts,
        parsed,
        isNaN: Number.isNaN(parsed),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return parsed;
}

module.exports = {
  ACTIONS,
  ACTION_PREFIXES,
  buildAction,
  parseActionId,
};
