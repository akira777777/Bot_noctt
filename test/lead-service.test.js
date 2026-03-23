const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const { createCatalogService } = require("../src/services/catalog-service");
const { createConversationService } = require("../src/services/conversation-service");
const { createLeadService } = require("../src/services/lead-service");

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-noct-lead-"));
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

function createTestServices() {
  const adminId = 9001;
  const { db, cleanup } = createTempDb();
  const repos = createRepositories(db);
  const sentMessages = [];
  const bot = {
    telegram: {
      async sendMessage(chatId, text, extra) {
        sentMessages.push({ chatId, text, extra });
        return { ok: true };
      },
    },
  };

  const catalogService = createCatalogService({ repos });
  const conversationService = createConversationService({ repos, bot, adminId });
  const leadService = createLeadService({
    repos,
    bot,
    adminId,
    catalogService,
    conversationService,
  });

  return {
    db,
    repos,
    leadService,
    sentMessages,
    cleanup,
  };
}

test("saveComment rejects blank input and keeps lead session on comment step", () => {
  const { repos, leadService, cleanup } = createTestServices();

  try {
    repos.sessions.set(1001, "lead", "comment", {
      productId: 1,
      productCode: "basic",
      productName: "Базовый пакет",
      quantity: 2,
      comment: "",
      contactLabel: "",
    });

    const session = leadService.getSession(1001);
    const result = leadService.saveComment({
      clientId: 1001,
      session,
      comment: "   ",
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "Комментарий не может быть пустым.");
    assert.equal(leadService.getSession(1001).step, "comment");
  } finally {
    cleanup();
  }
});

test("saveComment trims valid input and advances to contact step", () => {
  const { repos, leadService, cleanup } = createTestServices();

  try {
    repos.sessions.set(1002, "lead", "comment", {
      productId: 1,
      productCode: "basic",
      productName: "Базовый пакет",
      quantity: 1,
      comment: "",
      contactLabel: "",
    });

    const session = leadService.getSession(1002);
    const result = leadService.saveComment({
      clientId: 1002,
      session,
      comment: "  нужен быстрый ответ  ",
    });

    assert.equal(result.ok, true);
    assert.equal(result.nextStep, "contact");
    assert.equal(result.draft.comment, "нужен быстрый ответ");
    assert.equal(leadService.getSession(1002).step, "contact");
  } finally {
    cleanup();
  }
});

test("confirmLead persists lead-related records atomically and clears session", async () => {
  const { db, repos, leadService, sentMessages, cleanup } = createTestServices();

  try {
    repos.users.upsert({
      telegram_id: 1100,
      username: "client",
      first_name: "Test",
      last_name: null,
      role: "client",
    });

    repos.sessions.set(1100, "lead", "confirm", {
      productId: 1,
      productCode: "basic",
      productName: "Базовый пакет",
      quantity: 3,
      comment: "Нужно сегодня",
      contactLabel: "Telegram: @client",
      sourcePayload: "quote_channel",
    });

    const lead = await leadService.confirmLead({
      client: {
        id: 1100,
        username: "client",
        first_name: "Test",
        last_name: null,
      },
      chatId: 1100,
    });

    assert.equal(lead.duplicate, undefined);
    assert.equal(lead.product_code, "basic");
    assert.equal(lead.quantity, 3);
    assert.equal(repos.sessions.get(1100), null);

    const conversationCount = db
      .prepare("SELECT COUNT(*) AS count FROM conversations WHERE client_telegram_id = ?")
      .get(1100).count;
    const leadCount = db
      .prepare("SELECT COUNT(*) AS count FROM leads WHERE client_telegram_id = ?")
      .get(1100).count;
    const systemMessageCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM messages WHERE sender_role = 'system' AND sender_telegram_id = ?",
      )
      .get(1100).count;

    assert.equal(conversationCount, 1);
    assert.equal(leadCount, 1);
    assert.equal(systemMessageCount, 1);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].chatId, 9001);
  } finally {
    cleanup();
  }
});

test("confirmLead returns duplicate without creating extra records", async () => {
  const { db, repos, leadService, sentMessages, cleanup } = createTestServices();

  try {
    repos.users.upsert({
      telegram_id: 1200,
      username: "dup",
      first_name: "Dup",
      last_name: null,
      role: "client",
    });

    repos.leads.create({
      client_telegram_id: 1200,
      product_code: "basic",
      product_name: "Базовый пакет",
      quantity: 1,
      comment: "",
      contact_label: "Telegram",
      source_payload: null,
      status: "new",
    });
    repos.sessions.set(1200, "lead", "confirm", {
      productId: 1,
      productCode: "basic",
      productName: "Базовый пакет",
      quantity: 5,
      comment: "Повтор",
      contactLabel: "Telegram: @dup",
      sourcePayload: null,
    });

    const result = await leadService.confirmLead({
      client: {
        id: 1200,
        username: "dup",
        first_name: "Dup",
        last_name: null,
      },
      chatId: 1200,
    });

    assert.equal(result.duplicate, true);
    assert.ok(result.existingLead);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM leads WHERE client_telegram_id = ?").get(1200).count,
      1,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM messages WHERE sender_telegram_id = ?").get(1200).count,
      0,
    );
    assert.equal(repos.sessions.get(1200).step, "confirm");
    assert.equal(sentMessages.length, 0);
  } finally {
    cleanup();
  }
});
