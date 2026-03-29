#!/usr/bin/env node
/**
 * Startup Validation Script
 * Run this before starting the service in production
 */

const {
  NODE_ENV,
  BOT_ENABLED,
  ADMIN_ID,
  REDIS_CONFIG,
  API_COMPRESSION,
  LOG_FORMAT,
  LOG_LEVEL,
  MEMORY_LIMIT_WARN,
  MEMORY_LIMIT_CRITICAL,
} = require("../src/config/env");
const { resolveBotConfig } = require("../src/config/bot");

const required = ["API_SECRET"];
const warnings = [];

function checkEnvVariable(name) {
  const value = process.env[name];
  if (!value) {
    return { name, valid: false, message: `Missing ${name}` };
  }

  if (value.includes("YOUR_") || value.includes("CHANGE_")) {
    return {
      name,
      valid: false,
      message: `${name} contains placeholder value`,
    };
  }

  // Check for weak values
  if (name === "API_SECRET" && value.length < 32) {
    return {
      name,
      valid: true,
      warning: `${name} is shorter than 32 characters`,
    };
  }

  return { name, valid: true, value };
}

console.log("🔍 Bot_noct Startup Validation\n");
console.log("=".repeat(50));

// Check required environment variables
console.log("\n📋 Environment Variables:");
let allValid = true;

if (BOT_ENABLED) {
  required.unshift("ADMIN_ID", "BOT_TOKEN");
}

for (const varName of required) {
  const result = checkEnvVariable(varName);
  if (!result.valid) {
    console.log(`❌ ${result.name}: ${result.message}`);
    allValid = false;
  } else if (result.warning) {
    console.log(`⚠️  ${result.name}: ${result.warning}`);
    warnings.push(result.name);
  } else {
    const displayValue = result.value.substring(0, 8) + "...";
    console.log(`✅ ${result.name}: ${displayValue}`);
  }
}

// Check Redis connection
console.log("\n🔗 Services:");
console.log(`📡 Redis: ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);

// Check NODE_ENV
console.log("\n⚙️  Environment:");
const isProduction = NODE_ENV === "production";
const envEmoji = isProduction ? "🟢" : "🟡";
console.log(`${envEmoji} NODE_ENV: ${NODE_ENV}`);
console.log(`🤖 Telegram runtime: ${BOT_ENABLED ? "enabled" : "disabled"}`);
if (BOT_ENABLED && ADMIN_ID) {
  console.log(`👤 ADMIN_ID: ${ADMIN_ID}`);
}
console.log(`🗜 API compression: ${API_COMPRESSION ? "enabled" : "disabled"}`);
console.log(`🪵 Logging: level=${LOG_LEVEL}, format=${LOG_FORMAT}`);
console.log(
  `🧠 Memory thresholds: warn=${MEMORY_LIMIT_WARN}MB, critical=${MEMORY_LIMIT_CRITICAL}MB`,
);

if (!isProduction) {
  console.log("⚠️  Warning: Not running in production mode");
}

if (BOT_ENABLED) {
  try {
    const botConfig = resolveBotConfig({
      BOT_ENABLED,
      ADMIN_ID,
      isProduction,
    });
    console.log(`📨 Telegram delivery: ${botConfig.TELEGRAM_DELIVERY_MODE}`);
    if (botConfig.TELEGRAM_DELIVERY_MODE === "webhook") {
      if (!botConfig.WEBHOOK_DOMAIN) {
        console.log(
          "⚠️  WEBHOOK_DOMAIN is not set; runtime will fallback to polling",
        );
        warnings.push("WEBHOOK_DOMAIN");
      } else {
        console.log(`✅ WEBHOOK_DOMAIN: ${botConfig.WEBHOOK_DOMAIN}`);
      }
    }
    console.log(
      `⏱ Startup timeout: ${botConfig.TELEGRAM_STARTUP_TIMEOUT_MS}ms`,
    );
    console.log(
      `🛟 Allow bot launch failure: ${botConfig.ALLOW_BOT_LAUNCH_FAILURE ? "yes" : "no"}`,
    );
  } catch (error) {
    console.log(`❌ Telegram configuration: ${error.message}`);
    allValid = false;
  }
} else {
  console.log("📨 Telegram delivery: skipped (BOT_ENABLED=false)");
}

// Security checks
console.log("\n🔒 Security:");
const debugEndpoints =
  process.env.ENABLE_DEBUG_ENDPOINTS === "true" && isProduction;
if (debugEndpoints) {
  console.log("❌ DEBUG endpoints enabled in production!");
  allValid = false;
} else {
  console.log("✅ Debug endpoints disabled");
}

const diagnostics = process.env.ALLOW_DIAGNOSTICS === "true" && isProduction;
if (diagnostics) {
  console.log("⚠️  Diagnostics enabled (should be false in production)");
  warnings.push("ALLOW_DIAGNOSTICS");
} else {
  console.log("✅ Diagnostics disabled");
}

// Summary
console.log("\n" + "=".repeat(50));

if (allValid) {
  console.log("✅ All checks passed!");
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s) - review above`);
  }
  process.exit(0);
} else {
  console.log("❌ Validation failed - please fix the issues above");
  process.exit(1);
}
