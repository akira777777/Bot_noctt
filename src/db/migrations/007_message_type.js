function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

module.exports = {
  id: "007_message_type",
  up(db) {
    if (!hasColumn(db, "messages", "message_type")) {
      db.exec(
        "ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'",
      );
    }
  },
};
