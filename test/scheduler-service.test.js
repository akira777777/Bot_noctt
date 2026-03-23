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
    SET updated_at = datetime('now', '-16 minutes')
    WHERE telegram_id = ?
  `).run(501);

  await scheduler.sendDraftReminders();
  await scheduler.sendDraftReminders();

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /продолжить заявку/i);

  db.prepare(`
    UPDATE sessions
    SET updated_at = datetime('now', '-25 hours')
    WHERE telegram_id = ?
  `).run(501);

  await scheduler.sendDraftReminders();
  await scheduler.sendDraftReminders();

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /заявка всё ещё ждёт/i);
});
