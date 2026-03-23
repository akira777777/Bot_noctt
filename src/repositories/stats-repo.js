function createStatsRepository({ statements }) {
  return {
    leadCountsByStatus() {
      return statements.leadCountsByStatus.all();
    },
    topProductsByLeads(limit = 5) {
      return statements.topProductsByLeads.all(limit);
    },
    totalLeads() {
      return statements.totalLeads.get().cnt;
    },
  };
}

module.exports = { createStatsRepository };
