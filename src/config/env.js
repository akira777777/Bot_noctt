const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;
const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "bot.sqlite");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const WEBAPP_URL =
  process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || null;
const WEBAPP_BOT_USERNAME = process.env.WEBAPP_BOT_USERNAME || null;
const CORS_ORIGIN = process.env.CORS_ORIGIN || null;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set in environment variables");
}

if (!ADMIN_ID || Number.isNaN(ADMIN_ID)) {
  throw new Error("ADMIN_ID is not set or invalid in environment variables");
}

if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error("PORT is invalid in environment variables");
}

const isProduction = NODE_ENV === "production";

module.exports = {
  NODE_ENV,
  isProduction,
  BOT_TOKEN,
  ADMIN_ID,
  DB_PATH,
  PORT,
  WEBAPP_URL,
  WEBAPP_BOT_USERNAME,
  CORS_ORIGIN,
};
