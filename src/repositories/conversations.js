function createConversationsRepo(db) {
  const ensure = db.prepare(`
    INSERT INTO conversations (client_telegram_id, assigned_admin_id, status, source_payload, last_message_at)
    VALUES (?, ?, 'open', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_telegram_id) DO UPDATE SET
      last_message_at = CURRENT_TIMESTAMP,
      assigned_admin_id = COALESCE(conversations.assigned_admin_id, excluded.assigned_admin_id),
      source_payload = COALESCE(conversations.source_payload, excluded.source_payload)
    RETURNING *
  `);
  const getByClientId = db.prepare(
    `SELECT * FROM conversations WHERE client_telegram_id = ?`,
  );
  const listRecent = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.first_name,
      u.last_name,
      (
        SELECT m.message_text
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_text
    FROM conversations c
    LEFT JOIN users u ON u.telegram_id = c.client_telegram_id
    ORDER BY c.last_message_at DESC
    LIMIT ?
  `);

  return {
    ensure(clientTelegramId, adminId, sourcePayload = null) {
      return ensure.get(clientTelegramId, adminId, sourcePayload);
    },
    getByClientId(clientTelegramId) {
      return getByClientId.get(clientTelegramId);
    },
    listRecent(limit = 10) {
      return listRecent.all(limit);
    },
  };
}

module.exports = { createConversationsRepo };
