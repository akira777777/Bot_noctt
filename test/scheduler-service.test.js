const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const { createSchedulerService } = require("../src/services/scheduler-service");

function createSchedulerHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const repos = createRepositories(db);
  const sentMessages = [];
  const scheduler = createSchedulerService({
    repos,
    adminId: 1,
    bot: {
      telegram: {
        async sendMessage(chatId, text, extra) {
          sentMessages.push({ chatId, text, extra });
          return { ok: true };
        },
      },
    },
  });

  return {
    db,
    repos,
    scheduler,
    sentMessages,
  };
}

test("scheduler sends draft reminders at 15 minutes and 24 hours only once per draft", async () => {
  const { db, repos, scheduler, sentMessages } = createSchedulerHarness();

  repos.users.upsert({
    telegram_id: 501,
    username: "client501",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  repos.sessions.set(501, "lead", "confirm", {
    productId: 1,
    productCode: "p1",
    productName: "Товар",
    quantity: 4,
    contactLabel: "Telegram: @client501",
    sourcePayload: "quote_channel",
  });

  db.prepare(`
    UPDATE sessions
    SET updated_at = datetime('now', '-16 minutes'),
        last_interaction_at = datetime('now', '-16 minutes')
    WHERE telegram_id = ?
  `).run(501);

  await scheduler.sendDraftReminders();
  await scheduler.sendDraftReminders();

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /продолжить заявку/i);

  db.prepare(`
    UPDATE sessions
    SET updated_at = datetime('now', '-25 hours'),
        last_interaction_at = datetime('now', '-25 hours')
    WHERE telegram_id = ?
  `).run(501);

  await scheduler.sendDraftReminders();
  await scheduler.sendDraftReminders();

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /всё ещё жд[её]т подтверждения/i);
});

test("scheduler sends SLA reminders and due follow-up reminders only once", async () => {
  const { db, repos, scheduler, sentMessages } = createSchedulerHarness();

  repos.users.upsert({
    telegram_id: 601,
    username: "client601",
    first_name: "Client",
    last_name: null,
    role: "client",
  });
  repos.users.upsert({
    telegram_id: 602,
    username: "client602",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const newLead = repos.leads.create({
    client_telegram_id: 601,
    product_code: "p1",
    product_name: "Товар 1",
    quantity: 1,
    comment: "",
    contact_label: "Telegram",
    source_payload: "quote_channel",
    status: "new",
  });
  const followUpLead = repos.leads.create({
    client_telegram_id: 602,
    product_code: "p2",
    product_name: "Товар 2",
    quantity: 2,
    comment: "",
    contact_label: "Telegram",
    source_payload: "from_channel",
    status: "in_progress",
  });

  db.prepare(`
    UPDATE leads
    SET created_at = datetime('now', '-20 minutes'),
        updated_at = datetime('now', '-20 minutes'),
        next_follow_up_at = datetime('now', '-5 minutes')
    WHERE id = ?
  `).run(followUpLead.id);
  db.prepare(`
    UPDATE leads
    SET created_at = datetime('now', '-20 minutes'),
        updated_at = datetime('now', '-20 minutes')
    WHERE id = ?
  `).run(newLead.id);

  await scheduler.sendSlaReminders();
  await scheduler.sendSlaReminders();
  await scheduler.sendDueFollowUpReminders();
  await scheduler.sendDueFollowUpReminders();

  assert.equal(
    sentMessages.filter((msg) => /SLA/i.test(msg.text)).length,
    1,
  );
  assert.equal(
    sentMessages.filter((msg) => /follow-up/i.test(msg.text)).length,
    1,
  );
});
