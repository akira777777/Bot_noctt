function createLeadEventsRepo(db) {
  const insert = db.prepare(`
    INSERT INTO lead_events (
      lead_id,
      client_telegram_id,
      event_type,
      source_payload,
      metadata_json
    )
    VALUES (
      @lead_id,
      @client_telegram_id,
      @event_type,
      @source_payload,
      @metadata_json
    )
  `);
  const listByType = db.prepare(`
    SELECT *
    FROM lead_events
    WHERE event_type = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  const countByTypeSince = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM lead_events
    WHERE event_type = ?
      AND created_at >= ?
  `);
  const topSourcesByEventSince = db.prepare(`
    SELECT source_payload, COUNT(*) AS cnt
    FROM lead_events
    WHERE event_type = ?
      AND created_at >= ?
    GROUP BY source_payload
    ORDER BY cnt DESC, source_payload ASC
    LIMIT ?
  `);

  function parseRow(row) {
    let metadata = {};
    try {
      metadata = JSON.parse(row.metadata_json || "{}");
    } catch (_) {}

    return {
      ...row,
      metadata,
    };
  }

  return {
    create({
      leadId = null,
      clientTelegramId,
      eventType,
      sourcePayload = null,
      metadata = {},
    }) {
      insert.run({
        lead_id: leadId,
        client_telegram_id: clientTelegramId,
        event_type: eventType,
        source_payload: sourcePayload,
        metadata_json: JSON.stringify(metadata || {}),
      });
    },
    listByType(eventType, limit = 100) {
      return listByType.all(eventType, limit).map(parseRow);
    },
    countByTypeSince(eventType, sinceIso) {
      return countByTypeSince.get(eventType, sinceIso).cnt;
    },
    topSourcesByEventSince(eventType, sinceIso, limit = 5) {
      return topSourcesByEventSince.all(eventType, sinceIso, limit);
    },
  };
}

module.exports = { createLeadEventsRepo };
