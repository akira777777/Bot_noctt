function createSessionsRepository({ statements }) {
  return {
    set(telegramId, flow, step, draft) {
      statements.setSession.run(
        telegramId,
        flow,
        step,
        JSON.stringify(draft ?? {}),
      );
    },
    get(telegramId) {
      const session = statements.getSession.get(telegramId);
      if (!session) {
        return null;
      }

      const updatedAt = new Date(`${session.updated_at}Z`).getTime();
      if (Date.now() - updatedAt > 24 * 60 * 60 * 1000) {
        statements.clearSession.run(telegramId);
        return null;
      }

      let draft = {};
      try {
        draft = JSON.parse(session.draft_json || "{}");
      } catch {
        draft = {};
      }

      return { ...session, draft };
    },
    clear(telegramId) {
      statements.clearSession.run(telegramId);
    },
    clearExpired() {
      return statements.clearExpiredSessions.run();
    },
  };
}

module.exports = {
  createSessionsRepository,
};
