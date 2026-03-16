module.exports = {
  id: "005_add_indexes",
  up(db) {
    db.exec(`
      -- Index for leads by client_telegram_id (used in getOpenByClientAndProduct)
      CREATE INDEX IF NOT EXISTS idx_leads_client_telegram_id
      ON leads(client_telegram_id);

      -- Index for leads by client + product + status (prevent duplicates)
      CREATE INDEX IF NOT EXISTS idx_leads_client_product_status
      ON leads(client_telegram_id, product_code, status);

      -- Index for sessions by telegram_id
      CREATE INDEX IF NOT EXISTS idx_sessions_telegram_id
      ON sessions(telegram_id);

      -- Index for users by role (admin lookup)
      CREATE INDEX IF NOT EXISTS idx_users_role
      ON users(role);
    `);
  },
};
