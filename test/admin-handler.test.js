const test = require("node:test");
const assert = require("node:assert/strict");

function loadAdminHandlers(overrides) {
  const backup = { ...process.env };
  process.env = {
    ...backup,
    BOT_TOKEN: "bot:test",
    ADMIN_ID: "5913439523",
    ...overrides,
  };

  delete require.cache[require.resolve("../src/config/env")];
  delete require.cache[require.resolve("../src/utils/logger")];
  delete require.cache[require.resolve("../src/handlers/admin")];

  let mod;
  try {
    // eslint-disable-next-line global-require
    mod = require("../src/handlers/admin");
  } finally {
    process.env = backup;
    delete require.cache[require.resolve("../src/config/env")];
    delete require.cache[require.resolve("../src/utils/logger")];
    delete require.cache[require.resolve("../src/handlers/admin")];
  }

  return mod;
}

test("admin start removes stale client reply keyboard", async () => {
  const { handleAdminStart } = loadAdminHandlers();
  const replies = [];
  const ctx = {
    from: { id: 5913439523, username: "admin" },
    async reply(text, extra) {
      replies.push({ text, extra });
    },
  };

  const deps = {
    services: {
      admin: {
        upsertAdmin() {},
        getActiveClientId() {
          return null;
        },
      },
    },
  };

  await handleAdminStart(ctx, deps);

  assert.equal(replies.length, 1);
  assert.match(replies[0].text, /Команды администратора/);
  assert.deepEqual(replies[0].extra.reply_markup, {
    remove_keyboard: true,
  });
});
