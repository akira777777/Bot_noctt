module.exports = {
  id: "006_performance",
  up(db) {
    // Speeds up catalog queries that filter by is_active then sort by sort_order
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_products_active_sort ON products(is_active, sort_order)"
    ).run();

    // Speeds up admin queries filtering blocked/active users
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked)"
    ).run();

    // Speeds up date-range and ORDER BY on leads
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)"
    ).run();

    // Allows efficient cleanup of expired sessions
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)"
    ).run();
  },
};
