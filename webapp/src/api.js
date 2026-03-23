const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function apiRequest(path, initData, options = {}) {
  const url = `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
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
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error(
        "Unable to connect to server. Please check your internet connection.",
      );
    }
    throw error;
  }
}
