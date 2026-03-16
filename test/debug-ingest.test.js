const test = require("node:test");
const assert = require("node:assert/strict");

const { createDebugIngest } = require("../src/utils/debug-ingest");

test("createDebugIngest is a no-op when debug ingest is disabled", async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => {
    called = true;
    return { ok: true };
  };

  try {
    const ingest = createDebugIngest({});
    await ingest({
      runId: "test-run",
      location: "test:disabled",
      message: "disabled",
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(called, false);
});

test("createDebugIngest swallows network failures", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const ingest = createDebugIngest({
      url: "http://127.0.0.1:7414/ingest/test",
      sessionId: "session-1",
    });

    await assert.doesNotReject(() =>
      ingest({
        runId: "test-run",
        hypothesisId: "H1",
        location: "test:error",
        message: "should not throw",
      }),
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("createDebugIngest sends a structured payload when enabled", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true };
  };

  try {
    const ingest = createDebugIngest({
      url: "http://127.0.0.1:7414/ingest/test",
      sessionId: "session-2",
    });

    await ingest({
      runId: "run-1",
      hypothesisId: "H2",
      location: "test:enabled",
      message: "structured payload",
      data: { ok: true },
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:7414/ingest/test");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-Debug-Session-Id"], "session-2");

  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.sessionId, "session-2");
  assert.equal(body.runId, "run-1");
  assert.equal(body.hypothesisId, "H2");
  assert.equal(body.location, "test:enabled");
  assert.deepEqual(body.data, { ok: true });
});
