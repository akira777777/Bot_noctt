#!/usr/bin/env node
/**
 * Quick Health Check Script
 * Run this to verify the bot is running correctly
 */

const http = require("http");

const PORT = process.env.PORT || 3000;
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

  const [healthz, readyz, health] = await Promise.all([
    checkEndpoint("/healthz"),
    checkEndpoint("/readyz"),
    checkEndpoint("/health"),
  ]);

  if (healthz.ok && readyz.ok) {
    console.log("✅ Bot is running!");
    console.log("\n📊 Status:");
    console.log(`   Healthz: ${healthz.status}`);
    console.log(`   Readyz: ${readyz.status}`);

    if (health.ok && health.data) {
      console.log(`   Uptime: ${health.data.uptime}s`);
      console.log(`   Environment: ${health.data.environment}`);
      if (health.data.checks) {
        console.log("\n🔎 Checks:");
        for (const [name, result] of Object.entries(health.data.checks)) {
          console.log(`   ${name}: ${result.status}`);
        }
      }
    }

    process.exit(0);
  } else {
    console.log("❌ Bot health check failed!");
    console.log(
      `   /healthz: ${healthz.status}${healthz.error ? ` (${healthz.error})` : ""}`,
    );
    console.log(
      `   /readyz: ${readyz.status}${readyz.error ? ` (${readyz.error})` : ""}`,
    );
    process.exit(1);
  }
}

main();
