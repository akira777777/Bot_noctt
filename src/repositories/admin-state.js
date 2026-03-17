function createAdminStateRepo(db) {
  const set = db.prepare(`
    INSERT INTO admin_state (admin_telegram_id, active_client_telegram_id, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(admin_telegram_id) DO UPDATE SET
      active_client_telegram_id = excluded.active_client_telegram_id,
      updated_at = CURRENT_TIMESTAMP
  `);
  const get = db.prepare(
    `SELECT * FROM admin_state WHERE admin_telegram_id = ?`,
  );
  const clear = db.prepare(
    `DELETE FROM admin_state WHERE admin_telegram_id = ?`,
  );

  return {
    setActiveClient(adminTelegramId, clientTelegramId) {
      set.run(adminTelegramId, clientTelegramId);
    },
    get(adminTelegramId) {
      return get.get(adminTelegramId);
    },
    clear(adminTelegramId) {
      clear.run(adminTelegramId);
    },
  };
}

module.exports = { createAdminStateRepo };
