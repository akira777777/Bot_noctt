const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const { createWebServer } = require("../src/web/server");

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-noct-authz-"));
  const dbPath = path.join(dir, "bot.sqlite");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return {
    db,
    cleanup() {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("unauthenticated request gets 401 on admin endpoints", async (t) => {
  const adminId = 9001;
  const apiSecret = "test-secret-key";
  const { db, cleanup } = createTempDb();
  const repos = createRepositories(db);

  const app = createWebServer({
    repos,
    conversationService: {},
    bot: {},
    adminId,
    apiSecret,
    corsOrigin: null,
    isProduction: false,
  });
  const server = await startServer(app);

  t.after(() => {
    server.close();
    cleanup();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // No API key → 401
  const response = await fetch(`${baseUrl}/api/admin/leads`);
  assert.equal(response.status, 401);

  // Wrong API key → 401
  const response2 = await fetch(`${baseUrl}/api/admin/leads`, {
    headers: { "X-Api-Key": "wrong-key" },
  });
  assert.equal(response2.status, 401);

  // Correct API key → 200
  const response3 = await fetch(`${baseUrl}/api/admin/leads`, {
    headers: { "X-Api-Key": apiSecret },
  });
  assert.equal(response3.status, 200);
});
