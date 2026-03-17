module.exports = {
  id: "007_product_image",
  up(db) {
    db.prepare(
      "ALTER TABLE products ADD COLUMN image_url TEXT"
    ).run();
  },
};
