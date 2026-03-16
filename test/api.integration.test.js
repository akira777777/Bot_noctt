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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-noct-api-"));
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

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("admin API normalizes legacy lead filters and updates", async (t) => {
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
  repos.users.upsert({
    telegram_id: 1001,
    username: "client_1001",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const createdLead = repos.leads.create({
    client_telegram_id: 1001,
    product_code: "basic",
    product_name: "Базовый пакет",
    quantity: 2,
    comment: "",
    contact_label: "Telegram",
    source_payload: "from_channel",
    status: "new",
  });

  const app = createWebServer({ repos, botToken, adminId });
  const server = await startServer(app);
  t.after(async () => {
    await stopServer(server);
    cleanup();
  });

  const initData = buildTelegramInitData({
    botToken,
    user: {
      id: adminId,
      username: "admin",
      first_name: "Admin",
    },
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Authorization: `tma ${initData}`,
    "Content-Type": "application/json",
  };

  const meResponse = await fetch(`${baseUrl}/api/admin/me`, { headers });
  assert.equal(meResponse.status, 200);

  const newResponse = await fetch(`${baseUrl}/api/leads?status=new`, {
    headers,
  });
  const openResponse = await fetch(`${baseUrl}/api/leads?status=open`, {
    headers,
  });
  const newPayload = await newResponse.json();
  const openPayload = await openResponse.json();

  assert.deepEqual(
    newPayload.leads.map((lead) => lead.id),
    [createdLead.id],
  );
  assert.deepEqual(
    openPayload.leads.map((lead) => lead.id),
    [createdLead.id],
  );
  assert.equal(openPayload.leads[0].status, "new");

  const patchLegacyAliasResponse = await fetch(
    `${baseUrl}/api/leads/${createdLead.id}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "open" }),
    },
  );
  const patchLegacyAliasPayload = await patchLegacyAliasResponse.json();
  assert.equal(patchLegacyAliasResponse.status, 200);
  assert.equal(patchLegacyAliasPayload.lead.status, "new");

  const patchInvalidResponse = await fetch(
    `${baseUrl}/api/leads/${createdLead.id}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "unknown" }),
    },
  );

  assert.equal(patchInvalidResponse.status, 400);
});
