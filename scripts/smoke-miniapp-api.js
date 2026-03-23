const crypto = require("crypto");
const { createDatabase } = require("../src/db/sqlite");
const { createRepositories } = require("../src/repositories");
const { createWebServer } = require("../src/web/server");
const { BOT_TOKEN, ADMIN_ID } = require("../src/config/env");

function buildInitData() {
  const user = {
    id: ADMIN_ID,
    username: "admin_test",
    first_name: "Admin",
  };

  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("query_id", "AAEAAQ");
  params.set("user", JSON.stringify(user));

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);

  return params.toString();
}

async function main() {
  const db = createDatabase();
  const repos = createRepositories(db);
  const app = createWebServer({
    repos,
    botToken: BOT_TOKEN,
    adminId: ADMIN_ID,
  });

  const server = app.listen(0, async () => {
    try {
      const port = server.address().port;
      const initData = buildInitData();

      const response = await fetch(`http://127.0.0.1:${port}/api/admin/me`, {
        headers: {
          Authorization: `tma ${initData}`,
        },
      });
      const body = await response.text();

      if (response.status !== 200) {
        throw new Error(
          `Smoke check failed for /api/admin/me: status=${response.status}, body=${body}`,
        );
      }

      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("Smoke check failed: response is not valid JSON");
      }

      if (!parsed?.ok || !parsed?.user?.telegram_id) {
        throw new Error("Smoke check failed: malformed admin/me payload");
      }

      console.log("smoke:api ok");
    } finally {
      server.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
