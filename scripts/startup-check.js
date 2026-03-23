#!/usr/bin/env node
/**
 * Startup Validation Script
 * Run this before starting the bot in production
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const required = ["BOT_TOKEN", "ADMIN_ID", "API_SECRET"];
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

function checkFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

console.log("🔍 Bot_noct Startup Validation\n");
console.log("=".repeat(50));

// Check required environment variables
console.log("\n📋 Environment Variables:");
let allValid = true;

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
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = process.env.REDIS_PORT || "6379";
console.log(`📡 Redis: ${redisHost}:${redisPort}`);

// Check NODE_ENV
console.log("\n⚙️  Environment:");
const isProduction = process.env.NODE_ENV === "production";
const envEmoji = isProduction ? "🟢" : "🟡";
console.log(`${envEmoji} NODE_ENV: ${process.env.NODE_ENV || "not set"}`);

if (!isProduction) {
  console.log("⚠️  Warning: Not running in production mode");
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
