const path = require("path");
const dotenv = require("dotenv");
const { logWarn } = require("../utils/logger");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

function requiredString(key, fallbackKeys = []) {
  const value = [process.env[key]]
    .concat(fallbackKeys.map((fallbackKey) => process.env[fallbackKey]))
    .find(Boolean);
  if (!value || !value.trim()) {
    throw new Error(`${key} is required and must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(key, fallbackKeys = []) {
  const value = [process.env[key]]
    .concat(fallbackKeys.map((fallbackKey) => process.env[fallbackKey]))
    .find(Boolean);
  if (!value || !value.trim()) {
    return null;
  }
  return value.trim();
}

function optionalInteger(key, defaultValue) {
  if (!process.env[key]) {
    return defaultValue;
  }
  const parsed = Number.parseInt(process.env[key], 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be an integer`);
  }
  return parsed;
}

const NODE_ENV = optionalString("NODE_ENV") || "development";
const BOT_TOKEN = requiredString("BOT_TOKEN", ["TELEGRAM_BOT_TOKEN"]);
const ADMIN_ID = optionalInteger("ADMIN_ID", null);
const DB_PATH = optionalString("DB_PATH") || path.join(process.cwd(), "data", "bot.sqlite");
const PORT = optionalInteger("PORT", 3000);
const WEBAPP_URL = optionalString("WEBAPP_URL", ["RENDER_EXTERNAL_URL"]);
const WEBAPP_BOT_USERNAME = optionalString("WEBAPP_BOT_USERNAME");
const CORS_ORIGIN = optionalString("CORS_ORIGIN");

if (!ADMIN_ID || Number.isNaN(ADMIN_ID) || ADMIN_ID <= 0) {
  throw new Error("ADMIN_ID must be a positive integer");
}
if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error("PORT must be a positive integer");
}

const isProduction = NODE_ENV === "production";

if (isProduction && !process.env.CORS_ORIGIN) {
  logWarn(
    "CORS_ORIGIN is not set in production; all origins are currently allowed",
  );
}

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
