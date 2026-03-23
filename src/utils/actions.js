/**
 * Parses a numeric ID from a Telegraf callback action string.
 * Action format: "<namespace>:<type>:<id>" (e.g. "admin:lead_take:42")
 */
function parseActionId(action) {
  return Number(action.split(":")[2]);
}

module.exports = { parseActionId };
