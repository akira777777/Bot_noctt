function createSessionsRepo(db) {
  const set = db.prepare(`
    INSERT INTO sessions (telegram_id, flow, step, draft_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_id) DO UPDATE SET
      flow = excluded.flow,
      step = excluded.step,
      draft_json = excluded.draft_json,
      updated_at = CURRENT_TIMESTAMP
  `);
  const get = db.prepare(`
    SELECT * FROM sessions
    WHERE telegram_id = ?
      AND updated_at > datetime('now', '-24 hours')
  `);
  const clear = db.prepare(`DELETE FROM sessions WHERE telegram_id = ?`);
  const clearExpired = db.prepare(`
    DELETE FROM sessions WHERE updated_at <= datetime('now', '-24 hours')
  `);

  return {
    set(telegramId, flow, step, draft) {
      set.run(telegramId, flow, step, JSON.stringify(draft ?? {}));
    },
    get(telegramId) {
      const session = get.get(telegramId);
      if (!session) return null;

      let draft = {};
      try {
        draft = JSON.parse(session.draft_json || "{}");
      } catch (_) {}

      return { ...session, draft };
    },
    clear(telegramId) {
      clear.run(telegramId);
    },
    clearExpired() {
      return clearExpired.run().changes;
    },
  };
}

module.exports = { createSessionsRepo };
