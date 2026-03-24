module.exports = {
  id: "011_more_indexes",
  up(db) {
    db.exec(`
      -- Index for conversations by status (e.g. filtering open conversations)
      CREATE INDEX IF NOT EXISTS idx_conversations_status
      ON conversations(status);

      -- Index for messages by sender (e.g. fetching all messages from a given user)
      CREATE INDEX IF NOT EXISTS idx_messages_sender_telegram_id
      ON messages(sender_telegram_id);

      -- Index for leads by status (e.g. listing overdue or new leads)
      CREATE INDEX IF NOT EXISTS idx_leads_status
      ON leads(status);
    `);
  },
};
