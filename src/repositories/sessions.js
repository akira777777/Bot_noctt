const { logWarn } = require("../utils/logger");

function createSessionsRepo(db) {
  const SESSION_TTL_HOURS = 72;
  const set = db.prepare(`
    INSERT INTO sessions (
      telegram_id,
      flow,
      step,
      draft_json,
      updated_at,
      last_interaction_at,
      reminder_15_sent_at,
      reminder_24_sent_at
    )
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL)
    ON CONFLICT(telegram_id) DO UPDATE SET
      flow = excluded.flow,
      step = excluded.step,
      draft_json = excluded.draft_json,
      updated_at = CURRENT_TIMESTAMP,
      last_interaction_at = CURRENT_TIMESTAMP,
      reminder_15_sent_at = NULL,
      reminder_24_sent_at = NULL
  `);
  const get = db.prepare(`
    SELECT * FROM sessions
    WHERE telegram_id = ?
      AND COALESCE(last_interaction_at, updated_at) > datetime('now', '-${SESSION_TTL_HOURS} hours')
  `);
  const clear = db.prepare(`DELETE FROM sessions WHERE telegram_id = ?`);
  const clearExpired = db.prepare(`
    DELETE FROM sessions
    WHERE COALESCE(last_interaction_at, updated_at) <= datetime('now', '-${SESSION_TTL_HOURS} hours')
  `);
  const listLeadDraftsPending15m = db.prepare(`
    SELECT *
    FROM sessions
    WHERE flow = 'lead'
      AND COALESCE(last_interaction_at, updated_at) <= datetime('now', '-15 minutes')
      AND reminder_15_sent_at IS NULL
  `);
  const listLeadDraftsPending24h = db.prepare(`
    SELECT *
    FROM sessions
    WHERE flow = 'lead'
      AND COALESCE(last_interaction_at, updated_at) <= datetime('now', '-24 hours')
      AND reminder_24_sent_at IS NULL
  `);
  const markReminder15Sent = db.prepare(`
    UPDATE sessions
    SET reminder_15_sent_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);
  const markReminder24Sent = db.prepare(`
    UPDATE sessions
    SET reminder_24_sent_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `);

  function parseSession(session) {
    if (!session) return null;

    let draft = {};
    try {
      draft = JSON.parse(session.draft_json || "{}");
    } catch (err) {
      logWarn("Session draft_json parse failed; resetting draft", {
        telegramId: session.telegram_id,
        error: err.message,
      });
    }

    return { ...session, draft };
  }

  return {
    set(telegramId, flow, step, draft) {
      set.run(telegramId, flow, step, JSON.stringify(draft ?? {}));
    },
    get(telegramId) {
      return parseSession(get.get(telegramId));
    },
    clear(telegramId) {
      clear.run(telegramId);
    },
    clearExpired() {
      return clearExpired.run().changes;
    },
    listLeadDraftsPendingReminder(reminderKey) {
      const rows =
        reminderKey === "24h"
          ? listLeadDraftsPending24h.all()
          : listLeadDraftsPending15m.all();
      return rows.map(parseSession);
    },
    markReminderSent(telegramId, reminderKey) {
      if (reminderKey === "24h") {
        markReminder24Sent.run(telegramId);
        return;
      }
      markReminder15Sent.run(telegramId);
    },
  };
}

module.exports = { createSessionsRepo };
