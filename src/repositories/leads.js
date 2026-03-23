const {
  generateLeadTrackingToken,
} = require("../domain/tracking-token");

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
      status,
      tracking_token
    )
    VALUES (
      @client_telegram_id,
      @product_code,
      @product_name,
      @quantity,
      @comment,
      @contact_label,
      @source_payload,
      @status,
      @tracking_token
    )
    RETURNING *
  `);
  const getById = db.prepare(`SELECT * FROM leads WHERE id = ?`);
  const getByTrackingToken = db.prepare(`
    SELECT *
    FROM leads
    WHERE tracking_token = ?
  `);
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
  const listPaginated = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const listByStatusPaginated = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    WHERE l.status = ?
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const countAll = db.prepare(`SELECT COUNT(*) AS cnt FROM leads`);
  const countByStatus = db.prepare(
    `SELECT COUNT(*) AS cnt FROM leads WHERE status = ?`,
  );
  const updateStatus = db.prepare(`
    UPDATE leads
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `);
  const listStale = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    WHERE l.status = ?
      AND l.updated_at < datetime('now', ? || ' minutes')
    ORDER BY l.updated_at ASC
    LIMIT ?
  `);
  const countNewToday = db.prepare(`
    SELECT COUNT(*) AS cnt FROM leads
    WHERE created_at >= date('now')
  `);

  return {
    create(payload) {
      const nextPayload = {
        ...payload,
        tracking_token: payload.tracking_token || generateLeadTrackingToken(),
      };

      try {
        return create.get(nextPayload);
      } catch (error) {
        if (
          !payload.tracking_token &&
          typeof error?.message === "string" &&
          error.message.includes("idx_leads_tracking_token")
        ) {
          return create.get({
            ...payload,
            tracking_token: generateLeadTrackingToken(),
          });
        }
        throw error;
      }
    },
    list(limit = 10) {
      return list.all(limit);
    },
    listAll() {
      return listAll.all();
    },
    listPaginated(limit, offset) {
      return listPaginated.all(limit, offset);
    },
    listByStatusPaginated(status, limit, offset) {
      return listByStatusPaginated.all(status, limit, offset);
    },
    countAll() {
      return countAll.get().cnt;
    },
    countByStatus(status) {
      return countByStatus.get(status).cnt;
    },
    getById(id) {
      return getById.get(id);
    },
    getByTrackingToken(trackingToken) {
      return getByTrackingToken.get(trackingToken);
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
    listStale(status, olderThanMinutes, limit = 20) {
      return listStale.all(status, `-${olderThanMinutes}`, limit);
    },
    countNewToday() {
      return countNewToday.get().cnt;
    },
  };
}

module.exports = { createLeadsRepo };
