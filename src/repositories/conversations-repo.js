function createConversationsRepository({ statements }) {
  return {
    ensure(clientTelegramId, adminId, sourcePayload = null) {
      statements.ensureConversation.run(clientTelegramId, adminId, sourcePayload);
      return statements.getConversationByClient.get(clientTelegramId);
    },
    getByClientId(clientTelegramId) {
      return statements.getConversationByClient.get(clientTelegramId);
    },
    listRecent(limit = 10) {
      return statements.listRecentConversations.all(limit);
    },
  };
}

module.exports = { createConversationsRepository };
