module.exports = {
  id: "010_line_items_json",
  up(db) {
    db.exec(`
      ALTER TABLE leads ADD COLUMN line_items_json TEXT;
    `);
  },
};
