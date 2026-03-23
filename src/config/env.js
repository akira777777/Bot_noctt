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
const DB_PATH =
  optionalString("DB_PATH", ["DATABASE_PATH"]) ||
  path.join(process.cwd(), "data", "bot.sqlite");
const PORT = optionalInteger("PORT", 3000);
const API_SECRET = optionalString("API_SECRET");
const WEBHOOK_DOMAIN = optionalString("WEBHOOK_DOMAIN", [
  "RENDER_EXTERNAL_URL",
]);
const CORS_ORIGIN = optionalString("CORS_ORIGIN", ["ALLOWED_ORIGINS"]);
const TELEGRAM_DELIVERY_MODE_RAW = optionalString("TELEGRAM_DELIVERY_MODE");
const TELEGRAM_DELIVERY_MODE = TELEGRAM_DELIVERY_MODE_RAW
  ? TELEGRAM_DELIVERY_MODE_RAW.toLowerCase()
  : NODE_ENV === "production"
    ? "webhook"
    : "polling";
// Backward compatible:
// - primary: WEB_APP_URL
// - legacy/alt: WEBAPP_URL (no underscore)
const WEB_APP_URL = optionalString("WEB_APP_URL", ["WEBAPP_URL"]);

if (!ADMIN_ID || Number.isNaN(ADMIN_ID) || ADMIN_ID <= 0) {
  throw new Error("ADMIN_ID must be a positive integer");
}

const isProduction = NODE_ENV === "production";

if (isProduction && !API_SECRET) {
  logWarn(
    "API_SECRET is not set in production; admin API endpoints are disabled",
  );
}
if (isProduction && !CORS_ORIGIN) {
  logWarn("CORS_ORIGIN is not set in production; all origins are allowed");
}
if (
  TELEGRAM_DELIVERY_MODE !== "polling" &&
  TELEGRAM_DELIVERY_MODE !== "webhook"
) {
  throw new Error(
    "TELEGRAM_DELIVERY_MODE must be either 'polling' or 'webhook'",
  );
}
if (TELEGRAM_DELIVERY_MODE === "webhook" && !WEBHOOK_DOMAIN) {
  logWarn(
    "TELEGRAM_DELIVERY_MODE=webhook but WEBHOOK_DOMAIN is not set; app will fallback to polling",
  );
}

module.exports = {
  NODE_ENV,
  isProduction,
  BOT_TOKEN,
  ADMIN_ID,
  DB_PATH,
  PORT,
  API_SECRET,
  WEBHOOK_DOMAIN,
  TELEGRAM_DELIVERY_MODE,
  CORS_ORIGIN,
  WEB_APP_URL,
};
