const crypto = require("crypto");

function buildTelegramInitData({
  botToken,
  authDate = Math.floor(Date.now() / 1000),
  user,
  overrides = {},
}) {
  const values = {
    auth_date: String(authDate),
    ...overrides,
  };

  if (user) {
    values.user = JSON.stringify(user);
  }

  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const params = new URLSearchParams(values);
  params.set("hash", hash);
  return params.toString();
}

module.exports = {
  buildTelegramInitData,
};
