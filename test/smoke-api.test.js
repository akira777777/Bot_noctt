const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

test("smoke API runs in API-only mode when BOT_ENABLED=false", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bot-noct-smoke-"));
  const port = await getFreePort();

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/smoke-api.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: path.join(tempDir, "bot.sqlite"),
        ADMIN_ID: "1",
        BOT_ENABLED: "false",
      },
      stdio: "pipe",
    });

    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk.toString());
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      const output = stdout.join("") + stderr.join("");
      try {
        assert.equal(code, 0, output);
        assert.match(output, /Smoke OK/i);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
