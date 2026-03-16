module.exports = {
  id: "001_initial",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT NOT NULL DEFAULT 'client',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_telegram_id INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'open',
        assigned_admin_id INTEGER,
        source_payload TEXT,
        last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_telegram_id) REFERENCES users(telegram_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_role TEXT NOT NULL,
        sender_telegram_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_telegram_id INTEGER NOT NULL,
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        contact_label TEXT NOT NULL DEFAULT '',
        source_payload TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_telegram_id) REFERENCES users(telegram_id)
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price_text TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS admin_state (
        admin_telegram_id INTEGER PRIMARY KEY,
        active_client_telegram_id INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (active_client_telegram_id) REFERENCES users(telegram_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        telegram_id INTEGER PRIMARY KEY,
        flow TEXT NOT NULL DEFAULT 'idle',
        step TEXT NOT NULL DEFAULT 'idle',
        draft_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
      ON messages(conversation_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
      ON conversations(last_message_at DESC);

      CREATE INDEX IF NOT EXISTS idx_leads_status_created_at
      ON leads(status, created_at DESC);
    `);
  },
};
