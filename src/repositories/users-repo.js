function createUsersRepository({ statements }) {
  return {
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
  };
}

module.exports = { createUsersRepository };
