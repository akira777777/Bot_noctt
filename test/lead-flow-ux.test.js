const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { createRepositories } = require("../src/repositories");
const { runMigrations } = require("../src/db/migrations");
const { createLeadService } = require("../src/services/lead-service");
const { handleClientText } = require("../src/handlers/client");

function createLeadServiceHarness() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  const repos = createRepositories(db);
  const service = createLeadService({
    db,
    repos,
    bot: { telegram: { sendMessage: async () => {} } },
    adminId: 1,
    catalogService: {
      getProductById(productId) {
        return { id: productId, code: "p1", title: "Товар" };
      },
    },
    conversationService: {
      ensureConversation() {
        return { id: 1 };
      },
    },
  });

  return { db, repos, service };
}

test("lead service validates quantity with actionable messages", () => {
  const { service } = createLeadServiceHarness();
  const session = {
    flow: "lead",
    step: "quantity",
    draft: { productId: 1, productCode: "p1", productName: "Товар" },
  };

  const invalid = service.saveQuantity({
    clientId: 100,
    session,
    rawQuantity: "abc",
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /целым положительным числом/i);

  const tooBig = service.saveQuantity({
    clientId: 100,
    session,
    rawQuantity: "10001",
  });
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.error, /до 10000/i);
});

test("confirm edit quantity returns user to confirm step", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 777;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "from_channel" });
  const quantitySession = service.getSession(clientId);
  service.saveQuantity({
    clientId,
    session: quantitySession,
    rawQuantity: "2",
  });
  const commentSession = service.getSession(clientId);
  service.skipComment({ clientId, session: commentSession });
  const contactSession = service.getSession(clientId);
  service.useTelegramContact({
    client: { id: clientId, username: "user777" },
    session: contactSession,
  });

  const confirmSession = repos.sessions.get(clientId);
  assert.equal(confirmSession.step, "confirm");

  const editStart = service.startConfirmEdit({
    clientId,
    session: confirmSession,
    field: "quantity",
  });
  assert.equal(editStart.ok, true);
  assert.equal(editStart.nextStep, "quantity");

  const editSession = service.getSession(clientId);
  assert.equal(editSession.step, "quantity");
  assert.equal(editSession.draft.isConfirmEditing, true);

  const saveEditedQuantity = service.saveQuantity({
    clientId,
    session: editSession,
    rawQuantity: "5",
  });
  assert.equal(saveEditedQuantity.ok, true);
  assert.equal(saveEditedQuantity.nextStep, "confirm");
  assert.equal(saveEditedQuantity.draft.quantity, 5);
  assert.equal(saveEditedQuantity.draft.isConfirmEditing, false);
});

test("client text shortcut 'отмена' cancels lead flow", async () => {
  let clearedClientId = null;
  let setHomeCalled = false;
  const replies = [];

  const ctx = {
    from: { id: 301, username: "client301" },
    chat: { id: 301 },
    message: { text: "отмена" },
    async reply(text) {
      replies.push(text);
    },
  };

  const deps = {
    repos: {
      sessions: {
        get() {
          return {
            flow: "lead",
            step: "comment",
            draft: { sourcePayload: "src" },
          };
        },
        set() {
          setHomeCalled = true;
        },
      },
      leads: { getLatestByClient: () => null },
    },
    services: {
      conversation: {
        upsertTelegramUser() {
          return { is_blocked: 0 };
        },
        async forwardClientMessage() {
          throw new Error("must not forward when cancelling lead flow");
        },
      },
      lead: {
        getSession() {
          return {
            flow: "lead",
            step: "comment",
            draft: { sourcePayload: "src" },
          };
        },
        clearSession(clientId) {
          clearedClientId = clientId;
        },
      },
    },
  };

  await handleClientText(ctx, deps);
  assert.equal(clearedClientId, 301);
  assert.equal(setHomeCalled, true);
  assert.match(replies[0], /оформление заявки отменено/i);
});

test("client text shortcut 'назад' returns to previous lead step", async () => {
  const replies = [];
  let goBackCalled = false;

  const ctx = {
    from: { id: 302, username: "client302" },
    chat: { id: 302 },
    message: { text: "назад" },
    async reply(text) {
      replies.push(text);
    },
  };

  const deps = {
    repos: {
      sessions: { get: () => null },
      leads: { getLatestByClient: () => null },
    },
    services: {
      conversation: {
        upsertTelegramUser() {
          return { is_blocked: 0 };
        },
        async forwardClientMessage() {
          throw new Error("must not forward when moving back in lead flow");
        },
      },
      lead: {
        getSession() {
          return {
            flow: "lead",
            step: "contact",
            draft: { productId: 1, sourcePayload: "src" },
          };
        },
        goBack() {
          goBackCalled = true;
          return "comment";
        },
        hydrateProductForLead() {
          return { id: 1, code: "p1", title: "Товар" };
        },
      },
    },
  };

  await handleClientText(ctx, deps);
  assert.equal(goBackCalled, true);
  assert.match(replies[0], /шаг 2 из 4/i);
});

test("confirm edit comment/contact returns to confirm step", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 888;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "from_channel" });
  service.saveQuantity({
    clientId,
    session: service.getSession(clientId),
    rawQuantity: "3",
  });
  service.skipComment({ clientId, session: service.getSession(clientId) });
  service.useTelegramContact({
    client: { id: clientId, username: "user888" },
    session: service.getSession(clientId),
  });

  const confirmSession = repos.sessions.get(clientId);
  assert.equal(confirmSession.step, "confirm");

  const editComment = service.startConfirmEdit({
    clientId,
    session: confirmSession,
    field: "comment",
  });
  assert.equal(editComment.ok, true);
  assert.equal(service.getSession(clientId).step, "comment");

  const savedComment = service.saveComment({
    clientId,
    session: service.getSession(clientId),
    comment: "Нужен цвет синий",
  });
  assert.equal(savedComment.ok, true);
  assert.equal(savedComment.nextStep, "confirm");

  const editContact = service.startConfirmEdit({
    clientId,
    session: service.getSession(clientId),
    field: "contact",
  });
  assert.equal(editContact.ok, true);
  assert.equal(service.getSession(clientId).step, "contact");

  const savedContact = service.useTelegramContact({
    client: { id: clientId, username: "updated_user" },
    session: service.getSession(clientId),
  });
  assert.equal(savedContact.ok, true);
  assert.equal(savedContact.nextStep, "confirm");
});

test("confirm edit contact_custom returns to confirm after manual contact", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 889;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "from_channel" });
  service.saveQuantity({
    clientId,
    session: service.getSession(clientId),
    rawQuantity: "4",
  });
  service.skipComment({ clientId, session: service.getSession(clientId) });
  service.useTelegramContact({
    client: { id: clientId, username: "user889" },
    session: service.getSession(clientId),
  });

  const confirmSession = repos.sessions.get(clientId);
  assert.equal(confirmSession.step, "confirm");

  const editContact = service.startConfirmEdit({
    clientId,
    session: confirmSession,
    field: "contact",
  });
  assert.equal(editContact.ok, true);
  assert.equal(service.getSession(clientId).step, "contact");

  service.requestCustomContact({
    clientId,
    session: service.getSession(clientId),
  });
  const customContactSession = service.getSession(clientId);
  assert.equal(customContactSession.step, "contact_custom");
  assert.equal(customContactSession.draft.isConfirmEditing, true);

  const saveCustom = service.saveCustomContact({
    clientId,
    session: customContactSession,
    contactText: "+7 999 123-45-67",
  });
  assert.equal(saveCustom.ok, true);
  assert.equal(saveCustom.nextStep, "confirm");
  assert.equal(saveCustom.draft.contactLabel, "+7 999 123-45-67");
  assert.equal(saveCustom.draft.isConfirmEditing, false);
});
