const test = require("node:test");
const assert = require("node:assert/strict");

const SERVICE_MODULE_PATH = "../src/services/lead-status-service";
const TELEGRAM_UTILS_PATH = "../src/utils/telegram";
const {
  clientLeadTakenMessage,
  clientLeadOutOfStockMessage,
} = require("../src/ui/messages");

function loadLeadStatusService({ safeSendMessageImpl } = {}) {
  const servicePath = require.resolve(SERVICE_MODULE_PATH);
  const telegramUtilsPath = require.resolve(TELEGRAM_UTILS_PATH);
  const previousTelegramUtils = require.cache[telegramUtilsPath];
  const previousService = require.cache[servicePath];

  if (safeSendMessageImpl) {
    require.cache[telegramUtilsPath] = {
      id: telegramUtilsPath,
      filename: telegramUtilsPath,
      loaded: true,
      exports: {
        safeSendMessage: safeSendMessageImpl,
      },
    };
  } else {
    delete require.cache[telegramUtilsPath];
  }

  delete require.cache[servicePath];

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(SERVICE_MODULE_PATH);
  } finally {
    delete require.cache[servicePath];
    if (previousTelegramUtils) {
      require.cache[telegramUtilsPath] = previousTelegramUtils;
    } else {
      delete require.cache[telegramUtilsPath];
    }
    if (previousService) {
      require.cache[servicePath] = previousService;
    }
  }
}

test("lead status service rejects unsupported statuses without touching repository", async () => {
  let updateCalls = 0;
  const { createLeadStatusService } = loadLeadStatusService();

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus() {
          updateCalls += 1;
          return null;
        },
      },
    },
  });

  const result = await service.updateStatus(123, "unsupported_status");

  assert.equal(result, null);
  assert.equal(updateCalls, 0);
});

test("lead status service returns null when repository cannot find the lead", async () => {
  const notifications = [];
  const { createLeadStatusService } = loadLeadStatusService({
    safeSendMessageImpl: async (...args) => {
      notifications.push(args);
      return null;
    },
  });

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus() {
          return null;
        },
      },
    },
    bot: {
      telegram: {
        sendMessage() {},
      },
    },
  });

  const result = await service.updateStatus(999, "in_progress");

  assert.equal(result, null);
  assert.deepEqual(notifications, []);
});

test("lead status service sends a client notification for mapped statuses", async () => {
  const notifications = [];
  const { createLeadStatusService } = loadLeadStatusService({
    safeSendMessageImpl: async (...args) => {
      notifications.push(args);
      return { ok: true };
    },
  });

  const lead = {
    id: 7,
    status: "in_progress",
    client_telegram_id: 456789,
  };
  const bot = {
    telegram: {
      sendMessage() {},
    },
  };

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus(leadId, status) {
          assert.equal(leadId, 7);
          assert.equal(status, "in_progress");
          return lead;
        },
      },
    },
    bot,
  });

  const result = await service.updateStatus(7, "in_progress");

  assert.equal(result, lead);
  assert.deepEqual(notifications, [
    [
      bot,
      456789,
      clientLeadTakenMessage(),
    ],
  ]);
});

test("lead status service skips notification when client chat id is invalid", async () => {
  const notifications = [];
  const { createLeadStatusService } = loadLeadStatusService({
    safeSendMessageImpl: async (...args) => {
      notifications.push(args);
      return null;
    },
  });

  const lead = {
    id: 11,
    status: "fulfilled",
    client_telegram_id: 0,
  };

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus() {
          return lead;
        },
      },
    },
    bot: {
      telegram: {
        sendMessage() {},
      },
    },
  });

  const result = await service.updateStatus(11, "fulfilled");

  assert.equal(result, lead);
  assert.deepEqual(notifications, []);
});

test("lead status service persists closed reason and follow-up timestamp metadata", async () => {
  const { createLeadStatusService } = loadLeadStatusService();
  const updates = [];

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus(leadId, status, metadata) {
          updates.push({ leadId, status, metadata });
          return {
            id: leadId,
            status,
            closed_reason: metadata.closedReason || null,
            next_follow_up_at: metadata.nextFollowUpAt || null,
            client_telegram_id: 123,
          };
        },
      },
      leadEvents: {
        create() {},
      },
    },
  });

  const followUpAt = "2026-03-24T09:30:00.000Z";
  const result = await service.updateStatus(55, "closed", {
    closedReason: "out_of_stock",
    nextFollowUpAt: followUpAt,
    notifyClient: false,
  });

  assert.equal(result.closed_reason, "out_of_stock");
  assert.equal(result.next_follow_up_at, followUpAt);
  assert.deepEqual(updates, [
    {
      leadId: 55,
      status: "closed",
      metadata: {
        closedReason: "out_of_stock",
        nextFollowUpAt: followUpAt,
        notifyClient: false,
      },
    },
  ]);
});

test("lead status service uses a specific client notification for out_of_stock closes", async () => {
  const notifications = [];
  const { createLeadStatusService } = loadLeadStatusService({
    safeSendMessageImpl: async (...args) => {
      notifications.push(args);
      return { ok: true };
    },
  });

  const service = createLeadStatusService({
    repos: {
      leads: {
        updateStatus() {
          return {
            id: 77,
            status: "closed",
            closed_reason: "out_of_stock",
            client_telegram_id: 501,
          };
        },
      },
      leadEvents: {
        create() {},
      },
    },
    bot: {
      telegram: {
        sendMessage() {},
      },
    },
  });

  await service.updateStatus(77, "closed", {
    closedReason: "out_of_stock",
  });

  assert.equal(notifications[0][2], clientLeadOutOfStockMessage());
});
