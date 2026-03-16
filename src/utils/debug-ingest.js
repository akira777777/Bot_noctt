function createDebugIngest({ url = null, sessionId = null } = {}) {
  if (!url || !sessionId) {
    return async function noopDebugIngest() {};
  }

  return async function ingestDebugEvent(event) {
    const payload = {
      sessionId,
      ...event,
    };

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": sessionId,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return;
    }
  };
}

module.exports = {
  createDebugIngest,
};
