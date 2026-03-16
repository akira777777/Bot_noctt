const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidTelegramInitData,
} = require("../src/web/middleware/verify-telegram-init-data");
const { buildTelegramInitData } = require("./helpers/telegram-init-data");

test("isValidTelegramInitData accepts valid Telegram WebApp payloads", () => {
  const botToken = "bot:test-token";
  const initData = buildTelegramInitData({
    botToken,
    user: {
      id: 42,
      username: "admin_user",
      first_name: "Admin",
    },
  });

  const result = isValidTelegramInitData({ initData, botToken });

  assert.equal(result.ok, true);
  assert.equal(result.user.id, 42);
  assert.equal(result.user.username, "admin_user");
});

test("isValidTelegramInitData rejects expired payloads", () => {
  const botToken = "bot:test-token";
  const initData = buildTelegramInitData({
    botToken,
    authDate: Math.floor(Date.now() / 1000) - 10_000,
    user: { id: 7 },
  });

  const result = isValidTelegramInitData({
    initData,
    botToken,
    maxAgeSeconds: 5,
  });

  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("isValidTelegramInitData rejects invalid signatures", () => {
  const botToken = "bot:test-token";
  const initData = buildTelegramInitData({
    botToken,
    user: { id: 7 },
  }).replace("hash=", "hash=broken");

  const result = isValidTelegramInitData({ initData, botToken });

  assert.deepEqual(result, { ok: false, reason: "invalid_signature" });
});
