const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { DB_PATH } = require("../config/env");
const { runMigrations } = require("./migrations");

function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
}

function createDatabase() {
  ensureDbDirectory();

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("cache_size = -16000");
  db.pragma("temp_store = MEMORY");

  runMigrations(db);

  seedProducts(db);
  return db;
}

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
      code: "starter-pack",
      title: "Стартовый пакет",
      description: "Базовое решение для первичного запроса и консультации.",
      price_text: "от 2 900 ₽",
      sort_order: 1,
    },
    {
      code: "business-pack",
      title: "Расширенный пакет",
      description: "Подходит для регулярных запросов и расширенных требований.",
      price_text: "от 7 500 ₽",
      sort_order: 2,
    },
    {
      code: "custom-solution",
      title: "Индивидуальное решение",
      description: "Подберём конфигурацию, объём и условия под вашу задачу.",
      price_text: "по запросу",
      sort_order: 3,
    },
  ];

  db.transaction(() => {
    for (const product of defaults) {
      insert.run(product);
    }
  })();
}

module.exports = {
  createDatabase,
};
