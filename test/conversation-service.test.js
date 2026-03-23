const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const {
  createConversationService,
} = require("../src/services/conversation-service");

function createConversationHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const repos = createRepositories(db);
  const bot = {
    telegram: {
      async sendMessage() {
        return { ok: true };
      },
    },
  };

  return {
    db,
    repos,
    service: createConversationService({
      repos,
      bot,
      adminId: 1,
    }),
  };
}

test("first admin reply is recorded once on the latest open lead and logs an event", async () => {
  const { repos, service } = createConversationHarness();

  repos.users.upsert({
    telegram_id: 1,
    username: "admin",
    first_name: "Admin",
    last_name: null,
    role: "admin",
  });
  repos.users.upsert({
    telegram_id: 501,
    username: "client501",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const lead = repos.leads.create({
    client_telegram_id: 501,
    product_code: "p1",
    product_name: "Товар",
    quantity: 1,
    comment: "",
    contact_label: "Telegram: @client501",
    source_payload: "quote_channel",
    status: "new",
  });

  await service.sendAdminReply({
    adminTelegramId: 1,
    clientId: 501,
    text: "Проверяем наличие",
  });
  const updatedAfterFirstReply = repos.leads.getById(lead.id);
  const firstReplyAt = updatedAfterFirstReply.first_admin_reply_at;

  await service.sendAdminReply({
    adminTelegramId: 1,
    clientId: 501,
    text: "Есть ещё один апдейт",
  });
  const updatedAfterSecondReply = repos.leads.getById(lead.id);

  assert.ok(firstReplyAt);
  assert.equal(updatedAfterSecondReply.first_admin_reply_at, firstReplyAt);

  const firstReplyEvents = repos.leadEvents.listByType("admin_first_reply");
  assert.equal(firstReplyEvents.length, 1);
  assert.equal(firstReplyEvents[0].lead_id, lead.id);
});
