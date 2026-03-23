function createLeadsRepository({ statements }) {
  return {
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
  };
}

module.exports = { createLeadsRepository };
