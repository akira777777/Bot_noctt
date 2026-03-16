const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function apiRequest(path, initData, options = {}) {
  // #region agent log
  fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "8930e6",
    },
    body: JSON.stringify({
      sessionId: "8930e6",
      runId: "pre-fix",
      hypothesisId: "H7_FRONTEND_REQUEST_SETUP",
      location: "webapp/src/api.js:4",
      message: "Frontend API request started",
      data: {
        path,
        method: options.method || "GET",
        hasInitData: Boolean(initData),
        hasApiBase: Boolean(API_BASE),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `tma ${initData}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // #region agent log
    fetch("http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "8930e6",
      },
      body: JSON.stringify({
        sessionId: "8930e6",
        runId: "post-fix",
        hypothesisId: "H11_FRONTEND_API_FAILURE",
        location: "webapp/src/api.js:37",
        message: "Frontend API response failed",
        data: {
          path,
          method: options.method || "GET",
          statusCode: response.status,
          serverError: data?.error || null,
          hasDetails: Boolean(data?.details),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const details =
      data?.details && typeof data.details === "object"
        ? ` | ${JSON.stringify(data.details)}`
        : "";
    throw new Error(`${data.error || "Request failed"}${details}`);
  }

  return data;
}
