function createSessionService({ repos }) {
  function getCurrentSourcePayload(clientId, fallbackSource = null) {
    const session = repos.sessions.get(clientId);
    return session?.draft?.sourcePayload || fallbackSource || null;
  }

  function setHomeSession(clientId, sourcePayload) {
    repos.sessions.set(clientId, "home", "menu", {
      sourcePayload: sourcePayload || null,
    });
  }

  function clearSession(clientId) {
    repos.sessions.clear(clientId);
  }

  return {
    getCurrentSourcePayload,
    setHomeSession,
    clearSession,
  };
}

module.exports = {
  createSessionService,
};
