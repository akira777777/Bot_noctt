const crypto = require("crypto");

function isValidTelegramInitData({
  initData,
  botToken,
  maxAgeSeconds = 86400,
}) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!hash || !authDate || Number.isNaN(authDate)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    return { ok: false, reason: "expired" };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const valid =
    hash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));

  if (!valid) {
    return { ok: false, reason: "invalid_signature" };
  }

  let user = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (_) {
      return { ok: false, reason: "invalid_user" };
    }
  }

  return { ok: true, authDate, user };
}

function createVerifyTelegramInitData({ botToken, adminId }) {
  return function verifyTelegramInitData(req, res, next) {
    const authorization = req.headers.authorization || "";
    const bearer = authorization.startsWith("tma ")
      ? authorization.slice(4)
      : null;
    const initData = bearer || req.headers["x-telegram-init-data"];

    if (!initData) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "8930e6",
          },
          body: JSON.stringify({
            sessionId: "8930e6",
            runId: "pre-fix",
            hypothesisId: "H1_INITDATA_SOURCE",
            location: "src/web/middleware/verify-telegram-init-data.js:66",
            message: "Request rejected: missing init data",
            data: {
              path: req.path,
              method: req.method,
              hasAuthorizationHeader: Boolean(authorization),
              hasXTelegramHeader: Boolean(req.headers["x-telegram-init-data"]),
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      return res
        .status(401)
        .json({ ok: false, error: "Missing Telegram init data" });
    }

    const result = isValidTelegramInitData({
      initData,
      botToken,
    });

    if (!result.ok) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "8930e6",
          },
          body: JSON.stringify({
            sessionId: "8930e6",
            runId: "pre-fix",
            hypothesisId: "H2_INITDATA_VALIDATION",
            location: "src/web/middleware/verify-telegram-init-data.js:78",
            message: "Request rejected: invalid init data",
            data: {
              path: req.path,
              method: req.method,
              reason: result.reason || "unknown",
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      return res
        .status(401)
        .json({ ok: false, error: "Invalid Telegram auth data" });
    }

    const userId = result.user?.id ? Number(result.user.id) : null;
    req.auth = {
      telegram_id: userId,
      username: result.user?.username || null,
      first_name: result.user?.first_name || null,
      is_admin: userId === adminId,
      auth_date: result.authDate,
      init_data: initData,
    };
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
        hypothesisId: "H3_AUTH_CONTEXT",
        location: "src/web/middleware/verify-telegram-init-data.js:93",
        message: "Telegram auth accepted",
        data: {
          path: req.path,
          method: req.method,
          userId,
          adminId,
          isAdmin: userId === adminId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return next();
  };
}

module.exports = {
  isValidTelegramInitData,
  createVerifyTelegramInitData,
};
