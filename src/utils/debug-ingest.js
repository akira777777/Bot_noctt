const DEFAULT_TIMEOUT_MS = 1000;

function createDebugIngest({
  url,
  sessionId,
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!url || typeof fetchImpl !== "function") {
    return async function debugIngestNoop() {};
  }

  return async function debugIngest(event = {}) {
    const abortController =
      typeof AbortController === "function" ? new AbortController() : null;
    const timeout = abortController
      ? setTimeout(() => abortController.abort(), timeoutMs)
      : null;

    if (timeout && typeof timeout.unref === "function") {
      timeout.unref();
    }

    const headers = {
      "Content-Type": "application/json",
    };

    if (sessionId) {
      headers["X-Debug-Session-Id"] = sessionId;
    }

    const payload = {
      sessionId: sessionId || null,
      runId: event.runId || "runtime",
      hypothesisId: event.hypothesisId || null,
      location: event.location || "unknown",
      message: event.message || "",
      data: event.data || {},
      timestamp: Date.now(),
    };

    try {
      await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: abortController?.signal,
      });
    } catch (_) {
      return;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };
}

module.exports = {
  createDebugIngest,
};
