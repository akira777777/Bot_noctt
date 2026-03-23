const test = require("node:test");
const assert = require("node:assert/strict");

const {
  launchTelegramRuntime,
} = require("../src/services/telegram-runtime");

test("polling startup resolves without waiting for the long-running polling loop", async () => {
  let getMeCalls = 0;
  let deleteWebhookCalls = 0;
  let startPollingCalls = 0;

  const bot = {
    telegram: {
      async getMe() {
        getMeCalls += 1;
        return {
          id: 1,
          username: "noct_test_bot",
        };
      },
      async deleteWebhook() {
        deleteWebhookCalls += 1;
      },
    },
    startPolling() {
      startPollingCalls += 1;
      return new Promise(() => {});
    },
  };

  const started = await Promise.race([
    launchTelegramRuntime({
      bot,
      webhookEnabled: false,
      timeoutMs: 100,
      log: null,
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("startup did not resolve")), 250);
    }),
  ]);

  assert.equal(started.mode, "polling");
  assert.deepEqual(started.details, {
    username: "noct_test_bot",
  });
  assert.equal(getMeCalls, 1);
  assert.equal(deleteWebhookCalls, 1);
  assert.equal(startPollingCalls, 1);
  assert.equal(bot.botInfo.username, "noct_test_bot");
});

test("polling startup surfaces Telegram readiness failures before background polling begins", async () => {
  const bot = {
    telegram: {
      async getMe() {
        throw new Error("telegram unavailable");
      },
      async deleteWebhook() {},
    },
    startPolling() {
      throw new Error("must not start polling on failed readiness");
    },
  };

  await assert.rejects(
    launchTelegramRuntime({
      bot,
      webhookEnabled: false,
      timeoutMs: 100,
      log: null,
    }),
    /telegram unavailable/,
  );
});
