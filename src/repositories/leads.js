function createLeadsRepo(db) {
  const create = db.prepare(`
    INSERT INTO leads (
      client_telegram_id,
      product_code,
      product_name,
      quantity,
      comment,
      contact_label,
      source_payload,
      status
    )
    VALUES (
      @client_telegram_id,
      @product_code,
      @product_name,
      @quantity,
      @comment,
      @contact_label,
      @source_payload,
      @status
    )
    RETURNING *
  `);
  const getById = db.prepare(`SELECT * FROM leads WHERE id = ?`);
  const getLatestByClient = db.prepare(`
    SELECT * FROM leads
    WHERE client_telegram_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const getOpenByClientAndProduct = db.prepare(`
    SELECT * FROM leads
    WHERE client_telegram_id = ?
      AND product_code = ?
      AND status NOT IN ('closed', 'fulfilled')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const list = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    ORDER BY l.created_at DESC
    LIMIT ?
  `);
  const listAll = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    ORDER BY l.created_at DESC
    LIMIT 10000
  `);
  const updateStatus = db.prepare(`
    UPDATE leads
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `);

  return {
    create(payload) {
      return create.get(payload);
    },
    list(limit = 10) {
      return list.all(limit);
    },
    listAll() {
      return listAll.all();
    },
    getById(id) {
      return getById.get(id);
    },
    getLatestByClient(telegramId) {
      return getLatestByClient.get(telegramId);
    },
    getOpenByClientAndProduct(telegramId, productCode) {
      return getOpenByClientAndProduct.get(telegramId, productCode);
    },
    updateStatus(id, status) {
      return updateStatus.get(status, id);
    },
  };
}

module.exports = { createLeadsRepo };
