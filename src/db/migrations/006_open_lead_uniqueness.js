module.exports = {
  id: "006_open_lead_uniqueness",
  up(db) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_open_client_product
      ON leads(client_telegram_id, product_code)
      WHERE status IN ('new', 'in_progress', 'called_back', 'proposal_sent');
    `);
  },
};
