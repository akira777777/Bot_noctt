/**
 * Database initialization module
 * Backward-compatible wrapper around DatabaseConnectionManager
 */

const { DatabaseConnectionManager } = require("./connection");
const { runMigrations } = require("./migrations");
const { logInfo, logDebug } = require("../utils/logger");

/**
 * Legacy function for backward compatibility
 * Creates database with migrations and seeding
 */
async function createDatabase(dbPath, options = {}) {
  const manager = new DatabaseConnectionManager(dbPath, {
    maxRetries: options.maxRetries || 3,
    retryDelayMs: options.retryDelayMs || 100,
    busyTimeout: options.busyTimeout || 5000,
  });

  await manager.connect();

  const db = manager.getDatabase();

  // Run migrations
  runMigrations(db);

  // Seed products
  seedProducts(db);

  logInfo("Database initialized successfully");

  // Return both db and manager for new code
  return {
    db,
    manager,
    close: () => manager.close(),
  };
}

/**
 * Seed default products
 */
function seedProducts(db) {
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get().count;

  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO products (code, title, description, price_text, sort_order)
    VALUES (@code, @title, @description, @price_text, @sort_order)
  `);

  const defaults = [
    {
      code: "basic",
      title: "Базовый пакет",
      description: "Подходит для быстрого старта и базовой консультации.",
      price_text: "Цена уточняется",
      sort_order: 1,
    },
    {
      code: "standard",
      title: "Стандартный пакет",
      description:
        "Оптимальный вариант с расширенной поддержкой и доработками.",
      price_text: "Цена уточняется",
      sort_order: 2,
    },
    {
      code: "premium",
      title: "Премиум пакет",
      description:
        "Для клиентов, которым нужен приоритет и индивидуальные условия.",
      price_text: "Цена уточняется",
      sort_order: 3,
    },
  ];

  const tx = db.transaction(() => {
    for (const product of defaults) {
      insert.run(product);
    }
  });
  tx();

  logInfo("Default products seeded");
}

module.exports = {
  createDatabase,
  DatabaseConnectionManager,
};
