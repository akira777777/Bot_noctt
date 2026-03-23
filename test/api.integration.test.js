const test = require("node:test");
const assert = require("node:assert/strict");

const { createRepositories } = require("../src/repositories");
const { createWebServer } = require("../src/web/server");
const {
  createTempDb,
  startServer,
  stopServer,
} = require("../test-support/api-test-helpers");

test("admin API manages leads with status filters", async (t) => {
  const adminId = 9001;
  const apiSecret = "test-api-secret";
  const { db, cleanup } = createTempDb("bot-noct-api-");
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

  const exportResponse = await fetch(`${baseUrl}/api/admin/export/leads`, {
    headers,
  });
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") || "", /text\/csv/i);
});

test("admin CSV export stays protected by API key auth", async (t) => {
  const adminId = 9001;
  const apiSecret = "test-api-secret";
  const { db, cleanup } = createTempDb("bot-noct-api-");
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
  t.after(async () => {
    await stopServer(server);
    cleanup();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const unauthorized = await fetch(`${baseUrl}/api/admin/export/leads`);
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${baseUrl}/api/admin/export/leads`, {
    headers: { "X-Api-Key": apiSecret },
  });
  assert.equal(authorized.status, 200);
});
