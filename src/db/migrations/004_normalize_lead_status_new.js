function hasTable(db, tableName) {
  return Boolean(
    db.prepare(
      "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(tableName),
  );
}

module.exports = {
  id: "004_normalize_lead_status_new",
  up(db) {
    if (!hasTable(db, "leads")) {
      return;
    }

    db.prepare(`
      UPDATE leads
      SET status = 'new', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'open'
    `).run();
  },
};
