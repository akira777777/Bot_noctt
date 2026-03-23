const {
  loadEnvFiles,
  emitConfigWarning,
  requiredString,
  optionalString,
  optionalInteger,
  optionalBoolean,
} = require("./helpers");

loadEnvFiles();

function resolveBotConfig(runtimeConfig) {
  if (!runtimeConfig) {
    throw new Error("runtimeConfig is required");
  }

  if (!runtimeConfig.BOT_ENABLED) {
    return null;
  }

  const TELEGRAM_DELIVERY_MODE_RAW = optionalString("TELEGRAM_DELIVERY_MODE");
  const TELEGRAM_DELIVERY_MODE = TELEGRAM_DELIVERY_MODE_RAW
    ? TELEGRAM_DELIVERY_MODE_RAW.toLowerCase()
    : runtimeConfig.isProduction
      ? "webhook"
      : "polling";
  const WEBHOOK_DOMAIN = optionalString("WEBHOOK_DOMAIN", [
    "RENDER_EXTERNAL_URL",
  ]);
  const TELEGRAM_STARTUP_TIMEOUT_MS = optionalInteger(
    "TELEGRAM_STARTUP_TIMEOUT_MS",
    15000,
  );
  const ALLOW_BOT_LAUNCH_FAILURE = optionalBoolean(
    "ALLOW_BOT_LAUNCH_FAILURE",
    false,
  );
  const BOT_TOKEN = requiredString("BOT_TOKEN", ["TELEGRAM_BOT_TOKEN"]);

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

  return {
    BOT_TOKEN,
    TELEGRAM_DELIVERY_MODE,
    WEBHOOK_DOMAIN,
    TELEGRAM_STARTUP_TIMEOUT_MS,
    ALLOW_BOT_LAUNCH_FAILURE,
  };
}

module.exports = {
  resolveBotConfig,
};
