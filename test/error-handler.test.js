const test = require("node:test");
const assert = require("node:assert/strict");

const {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  trustProxy,
  RateLimitError,
  ValidationError,
} = require("../src/web/middleware/error-handler");

function createResponseDouble() {
  return {
    statusCode: null,
    headers: {},
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function createRequestDouble(overrides = {}) {
  return {
    path: "/test",
    method: "GET",
    ip: "127.0.0.1",
    user: null,
    get() {
      return null;
    },
    ...overrides,
  };
}

test("errorHandler returns validation payloads verbatim for client errors", () => {
  const req = createRequestDouble();
  const res = createResponseDouble();
  const err = new ValidationError("Invalid payload", { field: "contact" });

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error.code, "VALIDATION_ERROR");
  assert.equal(res.payload.error.message, "Invalid payload");
  assert.deepEqual(res.payload.error.details, { field: "contact" });
});

test("errorHandler adds Retry-After for rate-limited responses", () => {
  const req = createRequestDouble();
  const res = createResponseDouble();
  const err = new RateLimitError("Too fast", 30);

  errorHandler(err, req, res, () => {});

  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "30");
  assert.equal(res.payload.error.code, "RATE_LIMITED");
});

test("notFoundHandler returns a structured 404 response", () => {
  const req = createRequestDouble({ path: "/missing", method: "POST" });
  const res = createResponseDouble();

  notFoundHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error.code, "NOT_FOUND");
  assert.match(res.payload.error.message, /POST \/missing/);
});

test("asyncHandler forwards async failures to next", async () => {
  const req = createRequestDouble();
  const res = createResponseDouble();
  let capturedError = null;

  const handler = asyncHandler(async () => {
    throw new Error("boom");
  });

  await handler(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError.message, "boom");
});

test("trustProxy is enabled in production runtime", () => {
  assert.equal(trustProxy({}), true);
});
