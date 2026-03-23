const { spawn } = require("node:child_process");

const DEFAULT_PORT = 3001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { timeoutMs = 2000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function waitForHealthz({ baseUrl, attempts = 20, delayMs = 500 }) {
  let lastError = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const { status, body } = await fetchJson(`${baseUrl}/healthz`, {
        timeoutMs: 1500,
      });
      if (status === 200 && body && body.ok === true) {
        return;
      }
      lastError = new Error(`Unexpected /healthz response: ${status}`);
    } catch (err) {
      lastError = err;
    }

    await sleep(delayMs);
  }

  throw new Error(`Smoke failed: /healthz never became healthy (${String(lastError)})`);
}

async function runSmokeChecks({ baseUrl }) {
  const catalog = await fetchJson(`${baseUrl}/api/catalog`, { timeoutMs: 3000 });
  if (catalog.status !== 200 || !catalog.body || catalog.body.ok !== true) {
    throw new Error(`Smoke failed: /api/catalog not ok (status=${catalog.status})`);
  }
}

async function stopChild(child) {
  if (!child || child.killed) return;

  // Give it a chance to shutdown gracefully.
  child.kill("SIGTERM");

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve();
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const baseUrl = `http://127.0.0.1:${port}`;

  // Start API server (index.js) in a child process.
  // Bot polling/webhook failures are allowed (index.js continues in API-only mode in non-production).
  const child = spawn(process.execPath, ["index.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit",
  });

  try {
    await waitForHealthz({ baseUrl });
    await runSmokeChecks({ baseUrl });
    console.log("Smoke OK: API health and catalog endpoint are reachable.");
  } finally {
    await stopChild(child);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

