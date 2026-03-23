function createStatsRepo(db) {
  const leadCountsByStatus = db.prepare(
    `SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status ORDER BY cnt DESC`,
  );
  const topProductsByLeads = db.prepare(`
    SELECT product_code, product_name, COUNT(*) AS cnt
    FROM leads
    GROUP BY product_code
    ORDER BY cnt DESC
    LIMIT ?
  `);
  const totalLeads = db.prepare(`SELECT COUNT(*) AS cnt FROM leads`);

  return {
    leadCountsByStatus() {
      return leadCountsByStatus.all();
    },
    topProductsByLeads(limit = 5) {
      return topProductsByLeads.all(limit);
    },
    totalLeads() {
      return totalLeads.get().cnt;
    },
  };
}

module.exports = { createStatsRepo };
