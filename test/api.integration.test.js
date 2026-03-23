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

test("admin API manages leads with status filters", async (t) => {
  const adminId = 9001;
  const apiSecret = "test-api-secret";
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
  t.after(async () => {
    await stopServer(server);
    cleanup();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    "X-Api-Key": apiSecret,
    "Content-Type": "application/json",
  };

  // List leads filtered by status
  const newResponse = await fetch(`${baseUrl}/api/admin/leads?status=new`, {
    headers,
  });
  const newPayload = await newResponse.json();
  assert.equal(newResponse.status, 200);
  assert.deepEqual(
    newPayload.leads.map((lead) => lead.id),
    [createdLead.id],
  );

  // Update status
  const patchResponse = await fetch(
    `${baseUrl}/api/admin/leads/${createdLead.id}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "in_progress" }),
    },
  );
  const patchPayload = await patchResponse.json();
  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.lead.status, "in_progress");

  // Invalid status returns 400
  const patchInvalidResponse = await fetch(
    `${baseUrl}/api/admin/leads/${createdLead.id}/status`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "unknown" }),
    },
  );
  assert.equal(patchInvalidResponse.status, 400);
});
