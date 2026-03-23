const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_PATH = "../src/config/env";
const BOT_CONFIG_PATH = "../src/config/bot";

function loadBotConfig(overrides) {
  const backup = { ...process.env };
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, backup, overrides);

  delete require.cache[require.resolve(ENV_PATH)];
  delete require.cache[require.resolve(BOT_CONFIG_PATH)];

  let result;
  let error;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const runtimeConfig = require(ENV_PATH);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { resolveBotConfig } = require(BOT_CONFIG_PATH);
    result = resolveBotConfig(runtimeConfig);
  } catch (err) {
    error = err;
  } finally {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, backup);
    delete require.cache[require.resolve(ENV_PATH)];
    delete require.cache[require.resolve(BOT_CONFIG_PATH)];
  }

  return { result, error };
}

test("bot config resolves when bot is enabled and token is set", () => {
  const { result, error } = loadBotConfig({
    ADMIN_ID: "123",
    BOT_TOKEN: "bot:test",
  });

  assert.equal(error, undefined);
  assert.equal(result.BOT_TOKEN, "bot:test");
});

test("bot config returns null when bot is disabled", () => {
  const { result, error } = loadBotConfig({
    ADMIN_ID: "123",
    BOT_ENABLED: "false",
  });

  assert.equal(error, undefined);
  assert.equal(result, null);
});

test("bot config fails fast when bot is enabled without token", () => {
  const { error } = loadBotConfig({
    ADMIN_ID: "123",
  });

  assert.equal(error instanceof Error, true);
  assert.match(error.message, /BOT_TOKEN/);
});
