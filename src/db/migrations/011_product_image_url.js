module.exports = {
  id: "011_product_image_url",
  up(db) {
    db.exec(`
      ALTER TABLE products ADD COLUMN image_url TEXT;
    `);
  },
};
