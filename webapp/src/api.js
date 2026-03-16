const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function apiRequest(path, initData, options = {}) {
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
    const details =
      data?.details && typeof data.details === "object"
        ? ` | ${JSON.stringify(data.details)}`
        : "";
    throw new Error(`${data.error || "Request failed"}${details}`);
  }

  return data;
}
