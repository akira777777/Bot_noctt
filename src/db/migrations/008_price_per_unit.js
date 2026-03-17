module.exports = {
  id: "008_price_per_unit",
  up(db) {
    // Numeric price in kopecks/cents (integer avoids float rounding).
    // NULL means "price on request" — price_text stays as the display fallback.
    db.prepare(
      "ALTER TABLE products ADD COLUMN price_per_unit INTEGER"
    ).run();
  },
};
