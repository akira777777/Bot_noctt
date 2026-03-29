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

test("runtime env loader parses valid config without bot token", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    PORT: "4000",
  });
  assert.equal(error, undefined);
  assert.equal(result.ADMIN_ID, 123);
  assert.equal(result.PORT, 4000);
  assert.equal(result.BOT_ENABLED, true);
});

test("runtime env loader allows disabling bot explicitly", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    BOT_ENABLED: "false",
  });

  assert.equal(error, undefined);
  assert.equal(result.BOT_ENABLED, false);
});

test("env loader fails on invalid ADMIN_ID", () => {
  const { error } = loadEnvModule({
    ADMIN_ID: "abc",
  });
  assert.equal(error instanceof Error, true);
  assert.match(error.message, /ADMIN_ID/);
});

test("env loader ignores placeholder WEB_APP_URL values", () => {
  const { result, error } = loadEnvModule({
    BOT_TOKEN: "bot:test",
    ADMIN_ID: "123",
    WEB_APP_URL: "https://your-miniapp-domain.example/mini-app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader ignores localhost WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "http://localhost:3000/app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader ignores 127.0.0.1 WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "http://127.0.0.1:3000/app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader ignores .local domain WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "https://myapp.local/mini-app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader ignores non-http WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "ftp://example.com/app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader ignores unparseable WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "not a url at all",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, null);
});

test("env loader accepts valid public https WEB_APP_URL", () => {
  const { result, error } = loadEnvModule({
    ADMIN_ID: "123",
    WEB_APP_URL: "https://myapp.vercel.app/mini-app",
  });
  assert.equal(error, undefined);
  assert.equal(result.WEB_APP_URL, "https://myapp.vercel.app/mini-app");
});
