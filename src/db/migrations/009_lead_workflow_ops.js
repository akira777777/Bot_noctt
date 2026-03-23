function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

module.exports = {
  id: "009_lead_workflow_ops",
  up(db) {
    const leadColumns = [
      "first_admin_reply_at",
      "closed_reason",
      "last_client_activity_at",
      "next_follow_up_at",
      "sla_15m_reminded_at",
      "sla_60m_reminded_at",
      "follow_up_reminded_at",
    ];

    for (const column of leadColumns) {
      if (!hasColumn(db, "leads", column)) {
        db.exec(`ALTER TABLE leads ADD COLUMN ${column} TEXT`);
      }
    }

    const sessionColumns = [
      "last_interaction_at",
      "reminder_15_sent_at",
      "reminder_24_sent_at",
    ];

    for (const column of sessionColumns) {
      if (!hasColumn(db, "sessions", column)) {
        db.exec(`ALTER TABLE sessions ADD COLUMN ${column} TEXT`);
      }
    }

    db.exec(`
      UPDATE sessions
      SET last_interaction_at = COALESCE(last_interaction_at, updated_at)
      WHERE last_interaction_at IS NULL
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS lead_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        client_telegram_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        source_payload TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (client_telegram_id) REFERENCES users(telegram_id)
      );

      CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id_created_at
      ON lead_events(lead_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lead_events_type_created_at
      ON lead_events(event_type, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lead_events_client_created_at
      ON lead_events(client_telegram_id, created_at DESC);
    `);
  },
};
