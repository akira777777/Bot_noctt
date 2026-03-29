function createProductsRepo(db) {
  const list = db.prepare(
    `SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`,
  );
  const listAll = db.prepare(
    `SELECT * FROM products ORDER BY sort_order ASC, id ASC`,
  );
  const getById = db.prepare(`SELECT * FROM products WHERE id = ?`);
  const getByCode = db.prepare(`SELECT * FROM products WHERE code = ?`);
  const insert = db.prepare(`
    INSERT INTO products (code, title, description, price_text, image_url, is_active, sort_order)
    VALUES (@code, @title, @description, @price_text, @image_url, 1, @sort_order)
    RETURNING *
  `);
  const update = db.prepare(`
    UPDATE products
    SET title = @title, description = @description, price_text = @price_text,
        image_url = @image_url, sort_order = @sort_order
    WHERE id = @id
    RETURNING *
  `);
  const setActive = db.prepare(
    `UPDATE products SET is_active = ? WHERE id = ? RETURNING *`,
  );

  function normalizePayload(payload) {
    return {
      ...payload,
      image_url: payload.image_url ?? null,
    };
  }

  return {
    list() {
      return list.all();
    },
    listAll() {
      return listAll.all();
    },
    getById(id) {
      return getById.get(id);
    },
    getByCode(code) {
      return getByCode.get(code);
    },
    create(payload) {
      return insert.get(normalizePayload(payload));
    },
    update(payload) {
      return update.get(normalizePayload(payload));
    },
    setActive(id, isActive) {
      return setActive.get(isActive ? 1 : 0, id);
    },
  };
}

module.exports = { createProductsRepo };
