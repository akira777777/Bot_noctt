function createMessagesRepository({ statements }) {
  return {
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
  };
}

module.exports = { createMessagesRepository };
