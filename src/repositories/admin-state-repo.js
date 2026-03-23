function createAdminStateRepository({ statements }) {
  return {
    setActiveClient(adminTelegramId, clientTelegramId) {
      statements.setAdminState.run(adminTelegramId, clientTelegramId);
    },
    get(adminTelegramId) {
      return statements.getAdminState.get(adminTelegramId);
    },
    clear(adminTelegramId) {
      statements.clearAdminState.run(adminTelegramId);
    },
  };
}

module.exports = { createAdminStateRepository };
