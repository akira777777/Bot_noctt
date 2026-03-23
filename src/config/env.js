const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

function getFirstDefinedValue(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function requiredString(key, fallbackKeys = []) {
  const value = getFirstDefinedValue([key, ...fallbackKeys]);
  if (!value || !value.trim()) {
    throw new Error(`${key} is required and must be a non-empty string`);
  }
  return value;
}

function optionalString(key, fallbackKeys = []) {
  return getFirstDefinedValue([key, ...fallbackKeys]);
}

function optionalInteger(key, defaultValue, fallbackKeys = []) {
  const rawValue = getFirstDefinedValue([key, ...fallbackKeys]);
  if (rawValue === null) {
    return defaultValue;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be an integer`);
  }
  return parsed;
}

function optionalBoolean(key, defaultValue, fallbackKeys = []) {
  const rawValue = getFirstDefinedValue([key, ...fallbackKeys]);
  if (rawValue === null) {
    return defaultValue;
  }

  const normalized = rawValue.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`${key} must be a boolean`);
}

function emitConfigWarning(message) {
  // Avoid logger bootstrapping cycles in config loading.
  // eslint-disable-next-line no-console
  console.warn(`[WARN] ${message}`);
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
const API_COMPRESSION = optionalBoolean("API_COMPRESSION", true);
const LOG_LEVEL =
  optionalString("LOG_LEVEL") || (NODE_ENV === "production" ? "info" : "debug");
const LOG_FORMAT =
  optionalString("LOG_FORMAT") || (NODE_ENV === "production" ? "json" : "pretty");
const MEMORY_LIMIT_WARN = optionalInteger("MEMORY_LIMIT_WARN", 512);
const MEMORY_LIMIT_CRITICAL = optionalInteger("MEMORY_LIMIT_CRITICAL", 768);
const TELEGRAM_STARTUP_TIMEOUT_MS = optionalInteger(
  "TELEGRAM_STARTUP_TIMEOUT_MS",
  15000,
);
const ALLOW_BOT_LAUNCH_FAILURE = optionalBoolean(
  "ALLOW_BOT_LAUNCH_FAILURE",
  false,
);
const APP_VERSION = optionalString("APP_VERSION", ["npm_package_version"]) || "1.0.0";
// AI via Vercel AI Gateway. Auth options:
//   • OIDC (recommended): run `vercel link` then `vercel env pull`
//   • Manual key: set AI_GATEWAY_API_KEY from the Vercel dashboard
// Model uses "provider/model" format with dot-separated version: "anthropic/claude-haiku-4.5"
const AI_GATEWAY_API_KEY = optionalString("AI_GATEWAY_API_KEY");
const AI_MODEL = optionalString("AI_MODEL") || "anthropic/claude-haiku-4.5";
const AI_ENABLED = optionalBoolean("AI_ENABLED", true);
const REDIS_URL = optionalString("REDIS_URL");
const REDIS_HOST = optionalString("REDIS_HOST") || "localhost";
const REDIS_PORT = optionalInteger("REDIS_PORT", 6379);
const REDIS_PASSWORD = optionalString("REDIS_PASSWORD");
const REDIS_DB = optionalInteger("REDIS_DB", 0);
const REDIS_CONFIG = Object.freeze({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  db: REDIS_DB,
});
const CACHE_TTL = Object.freeze({
  SESSION: optionalInteger("CACHE_TTL_SESSION", 3600, ["REDIS_TTL_SESSION"]),
  CATALOG: optionalInteger("CACHE_TTL_CATALOG", 300, ["REDIS_TTL_CATALOG"]),
  PRODUCT: optionalInteger("CACHE_TTL_PRODUCT", 600, ["REDIS_TTL_PRODUCT"]),
  STATS: optionalInteger("CACHE_TTL_STATS", 60, ["REDIS_TTL_STATS"]),
  USER: optionalInteger("CACHE_TTL_USER", 1800, ["REDIS_TTL_USER"]),
  LEAD: optionalInteger("CACHE_TTL_LEAD", 300, ["REDIS_TTL_LEAD"]),
  CONVERSATION: optionalInteger("CACHE_TTL_CONVERSATION", 900, [
    "REDIS_TTL_CONVERSATION",
  ]),
});

if (!ADMIN_ID || Number.isNaN(ADMIN_ID) || ADMIN_ID <= 0) {
  throw new Error("ADMIN_ID must be a positive integer");
}

const isProduction = NODE_ENV === "production";

if (isProduction && !API_SECRET) {
  emitConfigWarning(
    "API_SECRET is not set in production; admin API endpoints are disabled",
  );
}
if (isProduction && !CORS_ORIGIN) {
  emitConfigWarning("CORS_ORIGIN is not set in production; all origins are allowed");
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
  emitConfigWarning(
    "TELEGRAM_DELIVERY_MODE=webhook but WEBHOOK_DOMAIN is not set; app will fallback to polling",
  );
}

module.exports = {
  NODE_ENV,
  isProduction,
  AI_GATEWAY_API_KEY,
  AI_ENABLED,
  BOT_TOKEN,
  ADMIN_ID,
  AI_GATEWAY_API_KEY,
  AI_MODEL,
  AI_ENABLED,
  DB_PATH,
  PORT,
  API_SECRET,
  WEBHOOK_DOMAIN,
  TELEGRAM_DELIVERY_MODE,
  CORS_ORIGIN,
  WEB_APP_URL,
  API_COMPRESSION,
  LOG_LEVEL,
  LOG_FORMAT,
  MEMORY_LIMIT_WARN,
  MEMORY_LIMIT_CRITICAL,
  TELEGRAM_STARTUP_TIMEOUT_MS,
  ALLOW_BOT_LAUNCH_FAILURE,
  APP_VERSION,
  REDIS_URL,
  REDIS_CONFIG,
  CACHE_TTL,
};
