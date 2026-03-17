function createUsersRepo(db) {
  const upsert = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, role, updated_at)
    VALUES (@telegram_id, @username, @first_name, @last_name, @role, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      role = excluded.role,
      updated_at = CURRENT_TIMESTAMP
  `);
  const getById = db.prepare(`SELECT * FROM users WHERE telegram_id = ?`);
  const getByUsername = db.prepare(
    `SELECT * FROM users WHERE lower(username) = lower(?)`,
  );
  const list = db.prepare(`SELECT * FROM users ORDER BY updated_at DESC LIMIT ?`);
  const listClients = db.prepare(
    `SELECT * FROM users WHERE role = 'client' AND is_blocked = 0`,
  );
  const block = db.prepare(
    `UPDATE users SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
  );
  const unblock = db.prepare(
    `UPDATE users SET is_blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
  );

  return {
    upsert(user) {
      upsert.run(user);
    },
    getById(telegramId) {
      return getById.get(telegramId);
    },
    getByUsername(username) {
      return getByUsername.get(username.replace(/^@/, ""));
    },
    list(limit = 100) {
      return list.all(limit);
    },
    listClients() {
      return listClients.all();
    },
    block(telegramId) {
      return block.run(telegramId);
    },
    unblock(telegramId) {
      return unblock.run(telegramId);
    },
  };
}

module.exports = { createUsersRepo };
