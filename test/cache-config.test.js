const test = require("node:test");
const assert = require("node:assert/strict");

const MODULE_PATH = "../src/services/cache-service";

function loadCacheModule(overrides) {
  const backup = { ...process.env };
  Object.assign(process.env, overrides);
  delete require.cache[require.resolve(MODULE_PATH)];

  let result;
  let error;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    result = require(MODULE_PATH);
  } catch (err) {
    error = err;
  } finally {
    process.env = backup;
    delete require.cache[require.resolve(MODULE_PATH)];
  }

  return { result, error };
}

test("cache service accepts CACHE_TTL_* aliases from runtime config", () => {
  const { result, error } = loadCacheModule({
    CACHE_TTL_SESSION: "111",
    CACHE_TTL_CATALOG: "222",
    CACHE_TTL_PRODUCT: "333",
    CACHE_TTL_STATS: "444",
    CACHE_TTL_USER: "555",
    CACHE_TTL_LEAD: "666",
    CACHE_TTL_CONVERSATION: "777",
  });

  assert.equal(error, undefined);
  assert.equal(result.CACHE_TTL.SESSION, 111);
  assert.equal(result.CACHE_TTL.CATALOG, 222);
  assert.equal(result.CACHE_TTL.PRODUCT, 333);
  assert.equal(result.CACHE_TTL.STATS, 444);
  assert.equal(result.CACHE_TTL.USER, 555);
  assert.equal(result.CACHE_TTL.LEAD, 666);
  assert.equal(result.CACHE_TTL.CONVERSATION, 777);
});
