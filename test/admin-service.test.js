const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { runMigrations } = require("../src/db/migrations");
const { createRepositories } = require("../src/repositories");
const { createAdminService } = require("../src/services/admin-service");

function createAdminHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const repos = createRepositories(db);
  const service = createAdminService({ repos });

  return { db, repos, service };
}

test("admin inbox prioritizes new leads without first reply before overdue follow-ups", () => {
  const { db, repos, service } = createAdminHarness();

  repos.users.upsert({
    telegram_id: 1,
    username: "admin",
    first_name: "Admin",
    last_name: null,
    role: "admin",
  });

  for (const clientId of [701, 702, 703]) {
    repos.users.upsert({
      telegram_id: clientId,
      username: `client${clientId}`,
      first_name: "Client",
      last_name: null,
      role: "client",
    });
    repos.conversations.ensure(clientId, 1, "quote_channel");
  }

  const urgentNewLead = repos.leads.create({
    client_telegram_id: 701,
    product_code: "p1",
    product_name: "Товар 1",
    quantity: 1,
    comment: "",
    contact_label: "Telegram",
    source_payload: "quote_channel",
    status: "new",
  });
  const overdueInProgressLead = repos.leads.create({
    client_telegram_id: 702,
    product_code: "p2",
    product_name: "Товар 2",
    quantity: 1,
    comment: "",
    contact_label: "Telegram",
    source_payload: "quote_channel",
    status: "in_progress",
  });
  repos.leads.create({
    client_telegram_id: 703,
    product_code: "p3",
    product_name: "Товар 3",
    quantity: 1,
    comment: "",
    contact_label: "Telegram",
    source_payload: "quote_channel",
    status: "new",
  });

  db.prepare(`
    UPDATE leads
    SET created_at = datetime('now', '-25 minutes'),
        updated_at = datetime('now', '-25 minutes')
    WHERE id = ?
  `).run(urgentNewLead.id);
  db.prepare(`
    UPDATE leads
    SET updated_at = datetime('now', '-3 hours'),
        next_follow_up_at = datetime('now', '-10 minutes')
    WHERE id = ?
  `).run(overdueInProgressLead.id);
  db.prepare(`
    UPDATE leads
    SET first_admin_reply_at = datetime('now', '-2 minutes')
    WHERE client_telegram_id = 703
  `).run();

  const inbox = service.listInbox(3);
  assert.deepEqual(
    inbox.map((item) => item.client_telegram_id),
    [701, 702, 703],
  );
});

test("admin dashboard stats summarize funnel and response windows for 24h and 7d", () => {
  const { repos, service } = createAdminHarness();

  repos.users.upsert({
    telegram_id: 801,
    username: "client801",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const lead = repos.leads.create({
    client_telegram_id: 801,
    product_code: "p1",
    product_name: "Товар 1",
    quantity: 2,
    comment: "",
    contact_label: "Telegram",
    source_payload: "quote_channel",
    status: "in_progress",
  });

  repos.leadEvents.create({
    leadId: null,
    clientTelegramId: 801,
    eventType: "lead_flow_started",
    sourcePayload: "quote_channel",
  });
  repos.leadEvents.create({
    leadId: lead.id,
    clientTelegramId: 801,
    eventType: "lead_confirmed",
    sourcePayload: "quote_channel",
  });
  repos.leads.updateStatus(lead.id, "in_progress", {
    nextFollowUpAt: null,
  });

  const dashboard = service.getDashboardStats();

  assert.equal(dashboard.last24Hours.draftsStarted, 1);
  assert.equal(dashboard.last24Hours.confirmedLeads, 1);
  assert.equal(dashboard.last24Hours.topSources[0].source_payload, "quote_channel");
  assert.ok("conversionRate" in dashboard.last7Days);
});
