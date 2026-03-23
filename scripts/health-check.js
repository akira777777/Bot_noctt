#!/usr/bin/env node
/**
 * Quick Health Check Script
 * Run this to verify the bot is running correctly
 */

const http = require("http");

const PORT = process.env.PORT || 3052;
const HOST = process.env.HOST || "localhost";

function checkEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: path,
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              ok: res.statusCode === 200,
              data: JSON.parse(data),
            });
          } catch {
            resolve({
              status: res.statusCode,
              ok: res.statusCode === 200,
              data: data.substring(0, 200),
            });
          }
        });
      },
    );

    req.on("error", (e) => {
      resolve({ status: 0, ok: false, error: e.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, ok: false, error: "Timeout" });
    });

    req.end();
  });
}

async function main() {
  console.log("🏥 Bot Health Check\n");
  console.log(`Target: http://${HOST}:${PORT}\n`);

  // Check main health endpoint
  const health = await checkEndpoint("/health");

  if (health.ok) {
    console.log("✅ Bot is running!");
    console.log("\n📊 Status:");
    console.log(
      `   Bot: ${health.data.bot === true ? "✅ Connected" : "❌ Disconnected"}`,
    );
    console.log(`   Uptime: ${health.data.uptime}s`);
    console.log(`   Mode: ${health.data.mode}`);

    if (health.data.stats) {
      console.log("\n📈 Statistics:");
      console.log(`   Leads: ${health.data.stats.totalLeads}`);
      console.log(`   Messages: ${health.data.stats.totalMessages}`);
    }

    process.exit(0);
  } else {
    console.log("❌ Bot health check failed!");
    if (health.error) {
      console.log(`   Error: ${health.error}`);
    } else {
      console.log(`   Status: ${health.status}`);
    }
    process.exit(1);
  }
}

main();
