const initialMigration = require("./001_initial");
const phase2ColumnsMigration = require("./002_phase2_columns");
const isBlockedMigration = require("./003_is_blocked");
const normalizeLeadStatusNewMigration = require("./004_normalize_lead_status_new");
const addIndexesMigration = require("./005_add_indexes");
const performanceMigration = require("./006_performance");
const productImageMigration = require("./007_product_image");

const migrations = [
  initialMigration,
  phase2ColumnsMigration,
  isBlockedMigration,
  normalizeLeadStatusNewMigration,
  addIndexesMigration,
  performanceMigration,
  productImageMigration,
];

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function runMigrations(db) {
  ensureMigrationTable(db);

  const appliedIds = new Set(
    db
      .prepare("SELECT id FROM schema_migrations ORDER BY applied_at ASC")
      .all()
      .map((row) => row.id),
  );

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    const transaction = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(
        migration.id,
      );
    });

    transaction();
  }
}

module.exports = {
  runMigrations,
};
