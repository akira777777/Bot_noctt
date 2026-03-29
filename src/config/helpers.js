const path = require("path");
const dotenv = require("dotenv");

let envLoaded = false;

function loadEnvFiles() {
  if (envLoaded) {
    return;
  }

  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config();
  envLoaded = true;
}

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

/**
 * Reads a URL string from env. Returns null if unset, unparseable, non-http(s),
 * a placeholder (.example / example.com), or a local-only address.
 */
function optionalUrlString(key, fallbackKeys = []) {
  const value = optionalString(key, fallbackKeys);
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    emitConfigWarning(`${key} is not a valid URL; treating it as unset`);
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    emitConfigWarning(`${key} must use http or https; treating it as unset`);
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "example.com" || hostname.endsWith(".example")) {
    emitConfigWarning(`${key} still uses a placeholder domain; treating it as unset`);
    return null;
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  ) {
    emitConfigWarning(`${key} points to a local address which cannot receive Telegram webhooks; treating it as unset`);
    return null;
  }

  return value;
}

module.exports = {
  loadEnvFiles,
  requiredString,
  optionalString,
  optionalInteger,
  optionalBoolean,
  optionalUrlString,
  emitConfigWarning,
};
