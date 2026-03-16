function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

module.exports = {
  id: "002_phase2_columns",
  up(db) {
    if (!hasColumn(db, "conversations", "source_payload")) {
      db.exec("ALTER TABLE conversations ADD COLUMN source_payload TEXT");
    }

    if (!hasColumn(db, "leads", "contact_label")) {
      db.exec(
        "ALTER TABLE leads ADD COLUMN contact_label TEXT NOT NULL DEFAULT ''",
      );
    }

    if (!hasColumn(db, "leads", "source_payload")) {
      db.exec("ALTER TABLE leads ADD COLUMN source_payload TEXT");
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
      ON messages(conversation_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
      ON conversations(last_message_at DESC);

      CREATE INDEX IF NOT EXISTS idx_leads_status_created_at
      ON leads(status, created_at DESC);
    `);
  },
};
