const test = require("node:test");
const assert = require("node:assert/strict");

const ENV_PATH = "../src/config/env";

function loadEnvModule(overrides) {
  const backup = { ...process.env };
  Object.assign(process.env, overrides);
  delete require.cache[require.resolve(ENV_PATH)];
  let result;
  let error;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    result = require(ENV_PATH);
  } catch (err) {
    error = err;
  } finally {
    process.env = backup;
    delete require.cache[require.resolve(ENV_PATH)];
  }
  return { result, error };
}

test("env loader parses valid config", () => {
  const { result, error } = loadEnvModule({
    BOT_TOKEN: "bot:test",
    ADMIN_ID: "123",
    PORT: "4000",
  });
  assert.equal(error, undefined);
  assert.equal(result.ADMIN_ID, 123);
  assert.equal(result.PORT, 4000);
});

test("env loader fails on invalid ADMIN_ID", () => {
  const { error } = loadEnvModule({
    BOT_TOKEN: "bot:test",
    ADMIN_ID: "abc",
  });
  assert.equal(error instanceof Error, true);
  assert.match(error.message, /ADMIN_ID/);
});
