function createMessagesRepo(db) {
  const insert = db.prepare(`
    INSERT INTO messages (conversation_id, sender_role, sender_telegram_id, message_text)
    VALUES (?, ?, ?, ?)
  `);
  const listByConversation = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return {
    create(conversationId, senderRole, senderTelegramId, text) {
      insert.run(conversationId, senderRole, senderTelegramId, text);
    },
    listByConversation(conversationId, limit = 10) {
      return listByConversation.all(conversationId, limit);
    },
  };
}

module.exports = { createMessagesRepo };
