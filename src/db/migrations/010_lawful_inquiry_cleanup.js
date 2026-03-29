function hasTable(db, tableName) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName);

  return Boolean(row);
}

const LEGACY_PRODUCT_REWRITES = Object.freeze([
  {
    match: {
      code: "methamphetamine",
      title: "METH",
    },
    next: {
      code: "starter-pack",
      title: "Стартовый пакет",
      description: "Базовое решение для первичного запроса и консультации.",
      price_text: "от 2 900 ₽",
      sort_order: 1,
    },
  },
  {
    match: {
      code: "cocaine",
      title: "COKE",
    },
    next: {
      code: "business-pack",
      title: "Расширенный пакет",
      description:
        "Подходит для регулярных запросов и расширенных требований.",
      price_text: "от 7 500 ₽",
      sort_order: 2,
    },
  },
  {
    match: {
      code: "xanax",
      title: "XANY",
    },
    next: {
      code: "custom-solution",
      title: "Индивидуальное решение",
      description: "Подберём конфигурацию, объём и условия под вашу задачу.",
      price_text: "по запросу",
      sort_order: 3,
    },
  },
]);

module.exports = {
  id: "010_lawful_inquiry_cleanup",
  up(db) {
    if (hasTable(db, "leads")) {
      db.exec(`
        UPDATE leads
        SET status = 'proposal_sent'
        WHERE status = 'awaiting_payment';
      `);

      db.exec(`
        DROP INDEX IF EXISTS idx_leads_unique_open_client_product;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_open_client_product
        ON leads(client_telegram_id, product_code)
        WHERE status IN ('new', 'in_progress', 'called_back', 'proposal_sent');
      `);
    }

    if (!hasTable(db, "products")) {
      return;
    }

    const findLegacyProduct = db.prepare(`
      SELECT id
      FROM products
      WHERE code = @code AND title = @title
      LIMIT 1
    `);
    const rewriteLegacyProduct = db.prepare(`
      UPDATE products
      SET code = @code,
          title = @title,
          description = @description,
          price_text = @price_text,
          sort_order = @sort_order
      WHERE id = @id
    `);

    for (const rewrite of LEGACY_PRODUCT_REWRITES) {
      const legacyProduct = findLegacyProduct.get(rewrite.match);
      if (!legacyProduct) {
        continue;
      }

      rewriteLegacyProduct.run({
        id: legacyProduct.id,
        ...rewrite.next,
      });
    }
  },
};
