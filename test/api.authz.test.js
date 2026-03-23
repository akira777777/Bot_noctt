const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const { createWebServer } = require("../src/web/server");
const { buildTelegramInitData } = require("./helpers/telegram-init-data");

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

test("non-admin user gets 403 on admin endpoints", async (t) => {
  const adminId = 9001;
  const botToken = "bot:test-token";
  const { db, cleanup } = createTempDb();
  const repos = createRepositories(db);
  repos.users.upsert({
    telegram_id: adminId,
    username: "admin",
    first_name: "Admin",
    last_name: null,
    role: "admin",
  });

  const app = createWebServer({ repos, botToken, adminId });
  const server = await startServer(app);

  t.after(() => {
    server.close();
    cleanup();
  });

  const initData = buildTelegramInitData({
    botToken,
    user: { id: 101, username: "client", first_name: "Client" },
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `tma ${initData}` };

  const response = await fetch(`${baseUrl}/api/leads`, { headers });
  assert.equal(response.status, 403);
});
