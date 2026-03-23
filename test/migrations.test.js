const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const initialMigration = require("../src/db/migrations/001_initial");
const phase2ColumnsMigration = require("../src/db/migrations/002_phase2_columns");
const isBlockedMigration = require("../src/db/migrations/003_is_blocked");
const { runMigrations } = require("../src/db/migrations");
const {
  LEAD_TRACKING_TOKEN_LENGTH,
} = require("../src/domain/tracking-token");

function createTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-noct-migration-"));
  const dbPath = path.join(dir, "bot.sqlite");
  const db = new Database(dbPath);

  return {
    db,
    cleanup() {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("runMigrations normalizes legacy lead open status without changing conversation status", () => {
  const { db, cleanup } = createTempDb();

  try {
    db.exec(`
      CREATE TABLE schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    initialMigration.up(db);
    phase2ColumnsMigration.up(db);
    isBlockedMigration.up(db);

    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(
      initialMigration.id,
    );
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(
      phase2ColumnsMigration.id,
    );
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(
      isBlockedMigration.id,
    );

    db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, role)
      VALUES (@telegram_id, @username, @first_name, @role)
    `).run({
      telegram_id: 101,
      username: "client_101",
      first_name: "Client",
      role: "client",
    });

    db.prepare(`
      INSERT INTO conversations (client_telegram_id, assigned_admin_id, status)
      VALUES (?, ?, ?)
    `).run(101, 1, "open");

    const leadId = db
      .prepare(`
        INSERT INTO leads (
          client_telegram_id,
          product_code,
          product_name,
          quantity,
          comment,
          contact_label,
          source_payload,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(101, "basic", "Базовый пакет", 1, "", "Telegram", "from_channel", "open")
      .lastInsertRowid;

    runMigrations(db);

    const lead = db
      .prepare("SELECT status, tracking_token FROM leads WHERE id = ?")
      .get(leadId);
    const conversation = db
      .prepare("SELECT status FROM conversations WHERE client_telegram_id = ?")
      .get(101);

    assert.equal(lead.status, "new");
    assert.match(
      lead.tracking_token,
      new RegExp(`^[a-f0-9]{${LEAD_TRACKING_TOKEN_LENGTH}}$`),
    );
    assert.equal(conversation.status, "open");
  } finally {
    cleanup();
  }
});

test("runMigrations adds lead workflow ops columns and lead events table", () => {
  const { db, cleanup } = createTempDb();

  try {
    runMigrations(db);

    const leadColumns = db.prepare("PRAGMA table_info(leads)").all();
    const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
    const leadEventsColumns = db.prepare("PRAGMA table_info(lead_events)").all();

    assert.ok(
      leadColumns.some((column) => column.name === "first_admin_reply_at"),
    );
    assert.ok(
      leadColumns.some((column) => column.name === "closed_reason"),
    );
    assert.ok(
      leadColumns.some((column) => column.name === "next_follow_up_at"),
    );
    assert.ok(
      sessionColumns.some((column) => column.name === "last_interaction_at"),
    );
    assert.ok(
      sessionColumns.some((column) => column.name === "reminder_15_sent_at"),
    );
    assert.ok(
      leadEventsColumns.some((column) => column.name === "event_type"),
    );
  } finally {
    cleanup();
  }
});
