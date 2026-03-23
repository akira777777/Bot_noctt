const {
  generateLeadTrackingToken,
} = require("../../domain/tracking-token");

module.exports = {
  id: "008_lead_tracking_token",
  up(db) {
    const columns = db.prepare("PRAGMA table_info(leads)").all();
    const hasTrackingToken = columns.some(
      (column) => column.name === "tracking_token",
    );

    if (!hasTrackingToken) {
      db.exec(`
        ALTER TABLE leads
        ADD COLUMN tracking_token TEXT
      `);
    }

    const existingTokens = new Set(
      db
        .prepare(`
          SELECT tracking_token
          FROM leads
          WHERE tracking_token IS NOT NULL
            AND tracking_token != ''
        `)
        .all()
        .map((row) => row.tracking_token),
    );

    const leadsWithoutToken = db.prepare(`
      SELECT id
      FROM leads
      WHERE tracking_token IS NULL
         OR tracking_token = ''
    `).all();

    const updateTrackingToken = db.prepare(`
      UPDATE leads
      SET tracking_token = @tracking_token,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    for (const lead of leadsWithoutToken) {
      let token = generateLeadTrackingToken();
      while (existingTokens.has(token)) {
        token = generateLeadTrackingToken();
      }

      existingTokens.add(token);
      updateTrackingToken.run({
        id: lead.id,
        tracking_token: token,
      });
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tracking_token
      ON leads(tracking_token)
    `);
  },
};
