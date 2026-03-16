const crypto = require("crypto");
const { BOT_TOKEN, ADMIN_ID } = require("../src/config/env");
const { createDatabase } = require("../src/db/sqlite");
const { createRepositories } = require("../src/repositories");
const { createWebServer } = require("../src/web/server");

function buildInitData() {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("query_id", "AAEAAQ");
  params.set(
    "user",
    JSON.stringify({
      id: ADMIN_ID,
      username: "admin_test",
      first_name: "Admin",
    }),
  );

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
      const authHeaders = { Authorization: `tma ${buildInitData()}` };

      const listResp = await fetch(`http://127.0.0.1:${port}/api/leads`, {
        headers: authHeaders,
      });
      const listBody = await listResp.json();
      const lead = (listBody.leads || [])[0];

      console.log("list status:", listResp.status);
      if (!lead) {
        console.log("No leads found, skipping patch verification.");
        return;
      }

      const patchResp = await fetch(
        `http://127.0.0.1:${port}/api/leads/${lead.id}/status`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "in_progress" }),
        },
      );
      const patchBody = await patchResp.json();
      console.log("patch status:", patchResp.status);
      console.log("patched lead status:", patchBody?.lead?.status || null);
    } finally {
      server.close();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
