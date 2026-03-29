const { generateLeadTrackingToken } = require("../domain/tracking-token");

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
      last_client_activity_at,
      first_admin_reply_at,
      closed_reason,
      next_follow_up_at,
      tracking_token,
      line_items_json
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
      COALESCE(@last_client_activity_at, CURRENT_TIMESTAMP),
      @first_admin_reply_at,
      @closed_reason,
      @next_follow_up_at,
      @tracking_token,
      @line_items_json
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
    SELECT *
    FROM leads
    WHERE client_telegram_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const getLatestOpenByClient = db.prepare(`
    SELECT *
    FROM leads
    WHERE client_telegram_id = ?
      AND status NOT IN ('closed', 'fulfilled')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const getOpenByClientAndProduct = db.prepare(`
    SELECT *
    FROM leads
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
    SET status = @status,
        closed_reason = @closed_reason,
        next_follow_up_at = @next_follow_up_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);
  const markFirstAdminReply = db.prepare(`
    UPDATE leads
    SET first_admin_reply_at = COALESCE(first_admin_reply_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `);
  const touchLastClientActivity = db.prepare(`
    UPDATE leads
    SET last_client_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `);
  const listPendingSla15m = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    WHERE l.status = 'new'
      AND l.first_admin_reply_at IS NULL
      AND l.created_at <= datetime('now', '-15 minutes')
      AND l.sla_15m_reminded_at IS NULL
    ORDER BY l.created_at ASC
    LIMIT ?
  `);
  const listPendingSla60m = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    WHERE l.status = 'new'
      AND l.first_admin_reply_at IS NULL
      AND l.created_at <= datetime('now', '-60 minutes')
      AND l.sla_60m_reminded_at IS NULL
    ORDER BY l.created_at ASC
    LIMIT ?
  `);
  const markSla15mReminderSent = db.prepare(`
    UPDATE leads
    SET sla_15m_reminded_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const markSla60mReminderSent = db.prepare(`
    UPDATE leads
    SET sla_60m_reminded_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const listDueFollowUps = db.prepare(`
    SELECT l.*, u.username, u.first_name, u.last_name
    FROM leads l
    LEFT JOIN users u ON u.telegram_id = l.client_telegram_id
    WHERE l.status NOT IN ('closed', 'fulfilled')
      AND l.next_follow_up_at IS NOT NULL
      AND l.next_follow_up_at <= CURRENT_TIMESTAMP
      AND l.follow_up_reminded_at IS NULL
    ORDER BY l.next_follow_up_at ASC
    LIMIT ?
  `);
  const markFollowUpReminderSent = db.prepare(`
    UPDATE leads
    SET follow_up_reminded_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const listPriorityInbox = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.first_name,
      u.last_name,
      l.id AS lead_id,
      l.status AS lead_status,
      l.product_name,
      l.created_at AS lead_created_at,
      l.updated_at AS lead_updated_at,
      l.first_admin_reply_at,
      l.next_follow_up_at,
      (
        SELECT m.message_text
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_text
    FROM conversations c
    LEFT JOIN users u ON u.telegram_id = c.client_telegram_id
    LEFT JOIN leads l ON l.id = (
      SELECT l2.id
      FROM leads l2
      WHERE l2.client_telegram_id = c.client_telegram_id
        AND l2.status NOT IN ('closed', 'fulfilled')
      ORDER BY l2.created_at DESC
      LIMIT 1
    )
    ORDER BY
      CASE
        WHEN l.status = 'new' AND l.first_admin_reply_at IS NULL THEN 0
        WHEN l.status = 'in_progress'
          AND l.next_follow_up_at IS NOT NULL
          AND l.next_follow_up_at <= CURRENT_TIMESTAMP THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN l.status = 'new' AND l.first_admin_reply_at IS NULL THEN l.created_at
        WHEN l.status = 'in_progress'
          AND l.next_follow_up_at IS NOT NULL
          AND l.next_follow_up_at <= CURRENT_TIMESTAMP THEN l.next_follow_up_at
        ELSE c.last_message_at
      END ASC
    LIMIT ?
  `);
  const listPriorityInboxPaginated = db.prepare(`
    SELECT
      c.*,
      u.username,
      u.first_name,
      u.last_name,
      l.id AS lead_id,
      l.status AS lead_status,
      l.product_name,
      l.created_at AS lead_created_at,
      l.updated_at AS lead_updated_at,
      l.first_admin_reply_at,
      l.next_follow_up_at,
      (
        SELECT m.message_text
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_text
    FROM conversations c
    LEFT JOIN users u ON u.telegram_id = c.client_telegram_id
    LEFT JOIN leads l ON l.id = (
      SELECT l2.id
      FROM leads l2
      WHERE l2.client_telegram_id = c.client_telegram_id
        AND l2.status NOT IN ('closed', 'fulfilled')
      ORDER BY l2.created_at DESC
      LIMIT 1
    )
    ORDER BY
      CASE
        WHEN l.status = 'new' AND l.first_admin_reply_at IS NULL THEN 0
        WHEN l.status = 'in_progress'
          AND l.next_follow_up_at IS NOT NULL
          AND l.next_follow_up_at <= CURRENT_TIMESTAMP THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN l.status = 'new' AND l.first_admin_reply_at IS NULL THEN l.created_at
        WHEN l.status = 'in_progress'
          AND l.next_follow_up_at IS NOT NULL
          AND l.next_follow_up_at <= CURRENT_TIMESTAMP THEN l.next_follow_up_at
        ELSE c.last_message_at
      END ASC
    LIMIT ? OFFSET ?
  `);
  const countOverdue = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM leads
    WHERE (
      status = 'new'
      AND first_admin_reply_at IS NULL
      AND created_at <= datetime('now', '-15 minutes')
    ) OR (
      status = 'in_progress'
      AND next_follow_up_at IS NOT NULL
      AND next_follow_up_at <= CURRENT_TIMESTAMP
    )
  `);
  const firstResponseDurationsSince = db.prepare(`
    SELECT
      CAST(strftime('%s', first_admin_reply_at) AS INTEGER) -
      CAST(strftime('%s', created_at) AS INTEGER) AS response_seconds
    FROM leads
    WHERE first_admin_reply_at IS NOT NULL
      AND created_at >= ?
    ORDER BY response_seconds ASC
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
        first_admin_reply_at: payload.first_admin_reply_at || null,
        closed_reason: payload.closed_reason || null,
        next_follow_up_at: payload.next_follow_up_at || null,
        last_client_activity_at: payload.last_client_activity_at || null,
        line_items_json: payload.line_items_json ?? null,
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
            ...nextPayload,
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
    getLatestOpenByClient(telegramId) {
      return getLatestOpenByClient.get(telegramId);
    },
    getOpenByClientAndProduct(telegramId, productCode) {
      return getOpenByClientAndProduct.get(telegramId, productCode);
    },
    updateStatus(id, status, metadata = {}) {
      return updateStatus.get({
        id,
        status,
        closed_reason: metadata.closedReason || null,
        next_follow_up_at: metadata.nextFollowUpAt || null,
      });
    },
    recordFirstAdminReplyByClient(telegramId) {
      const lead = getLatestOpenByClient.get(telegramId);
      if (!lead) {
        return { lead: null, updated: false };
      }
      if (lead.first_admin_reply_at) {
        return { lead, updated: false };
      }
      return {
        lead: markFirstAdminReply.get(lead.id),
        updated: true,
      };
    },
    touchLastClientActivityByClient(telegramId) {
      const lead = getLatestOpenByClient.get(telegramId);
      if (!lead) {
        return null;
      }
      return touchLastClientActivity.get(lead.id);
    },
    listStale(status, olderThanMinutes, limit = 20) {
      return listStale.all(status, `-${olderThanMinutes}`, limit);
    },
    countNewToday() {
      return countNewToday.get().cnt;
    },
    listPendingSlaReminder(reminderKey, limit = 20) {
      return reminderKey === "60m"
        ? listPendingSla60m.all(limit)
        : listPendingSla15m.all(limit);
    },
    markSlaReminderSent(leadId, reminderKey) {
      if (reminderKey === "60m") {
        markSla60mReminderSent.run(leadId);
        return;
      }
      markSla15mReminderSent.run(leadId);
    },
    listDueFollowUps(limit = 20) {
      return listDueFollowUps.all(limit);
    },
    markFollowUpReminderSent(leadId) {
      markFollowUpReminderSent.run(leadId);
    },
    listPriorityInbox(limit = 10) {
      return listPriorityInbox.all(limit);
    },
    listPriorityInboxPaginated(limit = 10, offset = 0) {
      return listPriorityInboxPaginated.all(limit, offset);
    },
    countOverdue() {
      return countOverdue.get().cnt;
    },
    firstResponseDurationsSince(sinceIso) {
      return firstResponseDurationsSince.all(sinceIso);
    },
  };
}

module.exports = { createLeadsRepo };
