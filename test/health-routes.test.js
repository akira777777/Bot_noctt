const test = require("node:test");
const assert = require("node:assert/strict");

const { NODE_ENV } = require("../src/config/env");
const { createWebServer } = require("../src/web/server");
const {
  createTempDb,
  startServer,
  stopServer,
} = require("../test-support/api-test-helpers");

test("health endpoints report healthy runtime details when dependencies are available", async (t) => {
  const { db, cleanup } = createTempDb("bot-noct-health-");

  const app = createWebServer({
    repos: {
      users: {
        getById() {
          return null;
        },
      },
    },
    conversationService: {},
    bot: {},
    adminId: 1,
    apiSecret: "secret",
    corsOrigin: null,
    isProduction: false,
    cacheService: {
      async healthCheck() {
        return { status: "healthy", mode: "redis" };
      },
    },
  });

  const server = await startServer(app);
  t.after(async () => {
    await stopServer(server);
    cleanup();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const healthz = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthz.status, 200);
  const healthzPayload = await healthz.json();
  assert.equal(healthzPayload.status, "ok");

  const readyz = await fetch(`${baseUrl}/readyz`);
  assert.equal(readyz.status, 200);
  const readyzPayload = await readyz.json();
  assert.equal(readyzPayload.ready, true);
  assert.equal(readyzPayload.checks.database.status, "ok");
  assert.equal(readyzPayload.checks.cache.status, "ok");

  const livez = await fetch(`${baseUrl}/livez`);
  assert.equal(livez.status, 200);
  const livezPayload = await livez.json();
  assert.equal(livezPayload.alive, true);

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  const healthPayload = await health.json();
  assert.equal(healthPayload.status, "healthy");
  assert.equal(healthPayload.environment, NODE_ENV);
  assert.equal(healthPayload.checks.cache.mode, "redis");
});

test("health endpoints degrade or fail when dependency checks fail", async (t) => {
  const { db, cleanup } = createTempDb("bot-noct-health-");

  const app = createWebServer({
    repos: {
      users: {
        getById() {
          throw new Error("db unavailable");
        },
      },
    },
    conversationService: {},
    bot: {},
    adminId: 1,
    apiSecret: "secret",
    corsOrigin: null,
    isProduction: false,
    cacheService: {
      async healthCheck() {
        return { status: "unhealthy", mode: "redis" };
      },
    },
  });

  const server = await startServer(app);
  t.after(async () => {
    await stopServer(server);
    cleanup();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const readyz = await fetch(`${baseUrl}/readyz`);
  assert.equal(readyz.status, 503);
  const readyzPayload = await readyz.json();
  assert.equal(readyzPayload.ready, false);
  assert.equal(readyzPayload.checks.database.status, "error");
  assert.equal(readyzPayload.checks.cache.status, "degraded");

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 503);
  const healthPayload = await health.json();
  assert.equal(healthPayload.status, "unhealthy");
  assert.equal(healthPayload.checks.database.status, "error");
});
