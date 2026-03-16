function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

module.exports = {
  id: "003_is_blocked",
  up(db) {
    if (!hasColumn(db, "users", "is_blocked")) {
      db.exec(
        "ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0",
      );
    }
  },
};
