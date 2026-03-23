const test = require("node:test");
const assert = require("node:assert/strict");

const {
  handleClientStart,
  handleClientText,
  handleClientAction,
} = require("../src/handlers/client");

function createReplyKeyboard(label) {
  return {
    reply_markup: {
      keyboard: [[{ text: label }]],
      resize_keyboard: true,
    },
  };
}

function createBaseDeps() {
  const sessionStore = new Map();
  const blockedUser = {
    telegram_id: 777,
    username: "blocked",
    first_name: "Blocked",
    last_name: null,
    role: "client",
    is_blocked: 1,
  };

  return {
    repos: {
      sessions: {
        get(telegramId) {
          return sessionStore.get(telegramId) || null;
        },
        set(telegramId, flow, step, draft) {
          sessionStore.set(telegramId, { telegram_id: telegramId, flow, step, draft });
        },
        clear(telegramId) {
          sessionStore.delete(telegramId);
        },
      },
      leads: {
        getLatestByClient() {
          return null;
        },
      },
    },
    bot: {
      telegram: {
        async setChatMenuButton() {
          return { ok: true };
        },
      },
    },
    services: {
      conversation: {
        upsertTelegramUser() {
          return blockedUser;
        },
        async forwardClientMessage() {
          throw new Error("should not forward blocked client message");
        },
      },
      lead: {
        getSession() {
          return null;
        },
      },
      catalog: {
        listProducts() {
          return [];
        },
      },
    },
    webappUrl: null,
  };
}

function createTextContext(text = "hello") {
  const replies = [];

  return {
    from: {
      id: 777,
      username: "blocked",
      first_name: "Blocked",
    },
    chat: {
      id: 777,
      type: "private",
    },
    message: {
      text,
    },
    replies,
    async reply(message, extra = {}) {
      replies.push({ message, extra });
      return { ok: true };
    },
  };
}

function createActionContext(action) {
  const answers = [];

  return {
    from: {
      id: 777,
      username: "blocked",
      first_name: "Blocked",
    },
    chat: {
      id: 777,
      type: "private",
    },
    callbackQuery: {
      id: "cbq-1",
      data: action,
    },
    match: [action],
    answers,
    async answerCbQuery(text) {
      answers.push(text);
      return { ok: true };
    },
  };
}

test("blocked client is rejected on /start", async () => {
  const deps = createBaseDeps();
  const ctx = createTextContext("/start");
  ctx.startPayload = "from_channel";

  await handleClientStart(ctx, deps);

  assert.deepEqual(ctx.replies, [
    {
      message: "Ваш аккаунт заблокирован. Обратитесь к администратору.",
      extra: {},
    },
  ]);
});

test("blocked client is rejected on free text", async () => {
  const deps = createBaseDeps();
  const ctx = createTextContext("нужна помощь");

  await handleClientText(ctx, deps);

  assert.deepEqual(ctx.replies, [
    {
      message: "Ваш аккаунт заблокирован. Обратитесь к администратору.",
      extra: {},
    },
  ]);
});

test("blocked client is rejected on callback action", async () => {
  const deps = createBaseDeps();
  const ctx = createActionContext("catalog:root");

  await handleClientAction(ctx, deps);

  assert.deepEqual(ctx.answers, ["Ваш аккаунт заблокирован."]);
});

test("invalid comment keeps client in comment step and shows validation error", async () => {
  const replies = [];
  const deps = {
    repos: {
      sessions: {
        get() {
          return null;
        },
      },
    },
    services: {
      conversation: {
        upsertTelegramUser() {
          return { is_blocked: 0 };
        },
      },
      lead: {
        getSession() {
          return {
            flow: "lead",
            step: "comment",
            draft: {
              productId: 1,
              productCode: "basic",
              productName: "Базовый пакет",
              quantity: 1,
              comment: "",
              contactLabel: "",
            },
          };
        },
        saveComment() {
          return {
            ok: false,
            error: "Комментарий не может быть пустым.",
          };
        },
      },
    },
  };
  const ctx = {
    from: {
      id: 500,
      username: "client",
      first_name: "Client",
    },
    chat: {
      id: 500,
      type: "private",
    },
    message: {
      text: "   ",
    },
    async reply(message, extra = {}) {
      replies.push({ message, extra });
      return { ok: true };
    },
  };

  await handleClientText(ctx, deps);

  assert.equal(replies.length, 1);
  assert.equal(replies[0].message, "Комментарий не может быть пустым.");
});
