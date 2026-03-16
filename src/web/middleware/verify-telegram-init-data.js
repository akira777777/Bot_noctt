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
      return res
        .status(401)
        .json({ ok: false, error: "Missing Telegram init data" });
    }

    const result = isValidTelegramInitData({
      initData,
      botToken,
    });

    if (!result.ok) {
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
    return next();
  };
}

module.exports = {
  isValidTelegramInitData,
  createVerifyTelegramInitData,
};
