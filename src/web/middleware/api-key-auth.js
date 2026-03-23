const crypto = require("crypto");

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createApiKeyAuth({ apiSecret }) {
  return function apiKeyAuth(req, res, next) {
    if (!apiSecret) {
      return res.status(503).json({
        ok: false,
        error: "Admin API is disabled: API_SECRET is not configured",
      });
    }

    const provided = req.headers["x-api-key"];
    if (typeof provided !== "string" || !safeEquals(provided, apiSecret)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    next();
  };
}

module.exports = { createApiKeyAuth };
