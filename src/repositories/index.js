const { createSessionsRepository } = require("./sessions-repo");

function createRepositories(db) {
  const statements = {
    upsertUser: db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, role, updated_at)
      VALUES (@telegram_id, @username, @first_name, @last_name, @role, CURRENT_TIMESTAMP)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        updated_at = CURRENT_TIMESTAMP
    `),
    getUser: db.prepare(`
      SELECT * FROM users WHERE telegram_id = ?
    `),
    listUsers: db.prepare(`
      SELECT * FROM users ORDER BY datetime(updated_at) DESC LIMIT ? OFFSET ?
    `),
    countUsers: db.prepare(`SELECT COUNT(*) AS cnt FROM users`),
    ensureConversation: db.prepare(`
      INSERT INTO conversations (client_telegram_id, assigned_admin_id, status, source_payload, last_message_at)
      VALUES (?, ?, 'open', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_telegram_id) DO UPDATE SET
        last_message_at = CURRENT_TIMESTAMP,
        assigned_admin_id = COALESCE(conversations.assigned_admin_id, excluded.assigned_admin_id),
        source_payload = COALESCE(conversations.source_payload, excluded.source_payload)
    `),
    getConversationByClient: db.prepare(`
      SELECT * FROM conversations WHERE client_telegram_id = ?
    `),
    listRecentConversations: db.prepare(`
      SELECT
        c.*,
        u.username,
        u.first_name,
        u.last_name,
        (
          SELECT m.message_text
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY datetime(m.created_at) DESC
          LIMIT 1
        ) AS last_message_text
      FROM conversations c
      LEFT JOIN users u ON u.telegram_id = c.client_telegram_id
      ORDER BY datetime(c.last_message_at) DESC
      LIMIT ?
    `),
    insertMessage: db.prepare(`
      INSERT INTO messages (conversation_id, sender_role, sender_telegram_id, message_text)
      VALUES (?, ?, ?, ?)
    `),
    listMessagesByConversation: db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at) DESC LIMIT ?
    `),
    createLead: db.prepare(`
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
    `),
    getLeadById: db.prepare(`
      SELECT * FROM leads WHERE id = ?
    `),
    getLatestLeadByClient: db.prepare(`
      SELECT * FROM leads WHERE client_telegram_id = ?
      ORDER BY datetime(created_at) DESC LIMIT 1
    `),
    getOpenLeadByClientAndProduct: db.prepare(`
      SELECT * FROM leads
      WHERE client_telegram_id = ?
        AND product_code = ?
        AND status NOT IN ('closed', 'fulfilled')
      ORDER BY datetime(created_at) DESC LIMIT 1
    `),
    listLeads: db.prepare(`
      SELECT l.*, u.username, u.first_name, u.last_name
      FROM leads l
      LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
      ORDER BY datetime(l.created_at) DESC
      LIMIT ?
    `),
    listAllLeads: db.prepare(`
      SELECT l.*, u.username, u.first_name, u.last_name
      FROM leads l
      LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
      ORDER BY datetime(l.created_at) DESC
    `),
    updateLeadStatus: db.prepare(`
      UPDATE leads
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
    listProducts: db.prepare(`
      SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, id ASC
    `),
    listAllProducts: db.prepare(`
      SELECT * FROM products ORDER BY sort_order ASC, id ASC
    `),
    getProductById: db.prepare(`
      SELECT * FROM products WHERE id = ?
    `),
    getProductByCode: db.prepare(`
      SELECT * FROM products WHERE code = ?
    `),
    insertProduct: db.prepare(`
      INSERT INTO products (code, title, description, price_text, is_active, sort_order)
      VALUES (@code, @title, @description, @price_text, 1, @sort_order)
    `),
    updateProduct: db.prepare(`
      UPDATE products
      SET title = @title, description = @description, price_text = @price_text, sort_order = @sort_order
      WHERE id = @id
    `),
    setProductActive: db.prepare(`
      UPDATE products SET is_active = ? WHERE id = ?
    `),
    setAdminState: db.prepare(`
      INSERT INTO admin_state (admin_telegram_id, active_client_telegram_id, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(admin_telegram_id) DO UPDATE SET
        active_client_telegram_id = excluded.active_client_telegram_id,
        updated_at = CURRENT_TIMESTAMP
    `),
    getAdminState: db.prepare(`
      SELECT * FROM admin_state WHERE admin_telegram_id = ?
    `),
    clearAdminState: db.prepare(`
      DELETE FROM admin_state WHERE admin_telegram_id = ?
    `),
    setSession: db.prepare(`
      INSERT INTO sessions (telegram_id, flow, step, draft_json, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(telegram_id) DO UPDATE SET
        flow = excluded.flow,
        step = excluded.step,
        draft_json = excluded.draft_json,
        updated_at = CURRENT_TIMESTAMP
    `),
    getSession: db.prepare(`
      SELECT * FROM sessions WHERE telegram_id = ?
    `),
    clearSession: db.prepare(`
      DELETE FROM sessions WHERE telegram_id = ?
    `),
    clearExpiredSessions: db.prepare(`
      DELETE FROM sessions WHERE datetime(updated_at) < datetime('now', '-24 hours')
    `),
    leadCountsByStatus: db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status ORDER BY cnt DESC
    `),
    topProductsByLeads: db.prepare(`
      SELECT product_code, product_name, COUNT(*) AS cnt
      FROM leads
      GROUP BY product_code
      ORDER BY cnt DESC
      LIMIT ?
    `),
    totalLeads: db.prepare(`SELECT COUNT(*) AS cnt FROM leads`),
    blockUser: db.prepare(
      `UPDATE users SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
    ),
    unblockUser: db.prepare(
      `UPDATE users SET is_blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
    ),
  };

  return {
    users: {
      upsert(user) {
        statements.upsertUser.run(user);
      },
      getById(telegramId) {
        return statements.getUser.get(telegramId);
      },
      list(limit = 100, offset = 0) {
        return statements.listUsers.all(limit, offset);
      },
      count() {
        return statements.countUsers.get().cnt;
      },
      block(telegramId) {
        return statements.blockUser.run(telegramId);
      },
      unblock(telegramId) {
        return statements.unblockUser.run(telegramId);
      },
    },
    conversations: {
      ensure(clientTelegramId, adminId, sourcePayload = null) {
        statements.ensureConversation.run(
          clientTelegramId,
          adminId,
          sourcePayload,
        );
        return statements.getConversationByClient.get(clientTelegramId);
      },
      getByClientId(clientTelegramId) {
        return statements.getConversationByClient.get(clientTelegramId);
      },
      listRecent(limit = 10) {
        return statements.listRecentConversations.all(limit);
      },
    },
    messages: {
      create(conversationId, senderRole, senderTelegramId, text) {
        statements.insertMessage.run(
          conversationId,
          senderRole,
          senderTelegramId,
          text,
        );
      },
      listByConversation(conversationId, limit = 10) {
        return statements.listMessagesByConversation.all(conversationId, limit);
      },
    },
    leads: {
      create(payload) {
        const result = statements.createLead.run(payload);
        return statements.getLeadById.get(result.lastInsertRowid);
      },
      list(limit = 10) {
        return statements.listLeads.all(limit);
      },
      listAll() {
        return statements.listAllLeads.all();
      },
      getById(id) {
        return statements.getLeadById.get(id);
      },
      getLatestByClient(telegramId) {
        return statements.getLatestLeadByClient.get(telegramId);
      },
      getOpenByClientAndProduct(telegramId, productCode) {
        return statements.getOpenLeadByClientAndProduct.get(
          telegramId,
          productCode,
        );
      },
      updateStatus(id, status) {
        statements.updateLeadStatus.run(status, id);
        return statements.getLeadById.get(id);
      },
    },
    products: {
      list() {
        return statements.listProducts.all();
      },
      listAll() {
        return statements.listAllProducts.all();
      },
      getById(id) {
        return statements.getProductById.get(id);
      },
      getByCode(code) {
        return statements.getProductByCode.get(code);
      },
      create(payload) {
        const result = statements.insertProduct.run(payload);
        return statements.getProductById.get(result.lastInsertRowid);
      },
      update(payload) {
        statements.updateProduct.run(payload);
        return statements.getProductById.get(payload.id);
      },
      setActive(id, isActive) {
        statements.setProductActive.run(isActive ? 1 : 0, id);
        return statements.getProductById.get(id);
      },
    },
    adminState: {
      setActiveClient(adminTelegramId, clientTelegramId) {
        statements.setAdminState.run(adminTelegramId, clientTelegramId);
      },
      get(adminTelegramId) {
        return statements.getAdminState.get(adminTelegramId);
      },
      clear(adminTelegramId) {
        statements.clearAdminState.run(adminTelegramId);
      },
    },
    stats: {
      leadCountsByStatus() {
        return statements.leadCountsByStatus.all();
      },
      topProductsByLeads(limit = 5) {
        return statements.topProductsByLeads.all(limit);
      },
      totalLeads() {
        return statements.totalLeads.get().cnt;
      },
    },
    sessions: createSessionsRepository({ statements }),
  };
}

module.exports = {
  createRepositories,
};
