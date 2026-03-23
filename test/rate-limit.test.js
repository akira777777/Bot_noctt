const test = require("node:test");
const assert = require("node:assert/strict");

const { createRateLimiter } = require("../src/web/middleware/rate-limit");

function createMockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("rate limiter uses req.ip by default", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
  const req = { ip: "1.2.3.4", socket: { remoteAddress: "9.9.9.9" } };

  const res1 = createMockRes();
  let called1 = false;
  limiter(req, res1, () => {
    called1 = true;
  });
  assert.equal(called1, true);
  assert.equal(res1.statusCode, 200);

  const res2 = createMockRes();
  let called2 = false;
  limiter(req, res2, () => {
    called2 = true;
  });
  assert.equal(called2, false);
  assert.equal(res2.statusCode, 429);
  assert.equal(res2.body.ok, false);
});

test("rate limiter supports custom key generator", () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 1,
    keyGenerator: (req) => req.headers["x-user-id"] || "anon",
  });

  const reqA = { headers: { "x-user-id": "10" } };
  const reqB = { headers: { "x-user-id": "20" } };

  const resA = createMockRes();
  limiter(reqA, resA, () => {});
  assert.equal(resA.statusCode, 200);

  const resB = createMockRes();
  let calledB = false;
  limiter(reqB, resB, () => {
    calledB = true;
  });
  assert.equal(calledB, true);
  assert.equal(resB.statusCode, 200);
});
