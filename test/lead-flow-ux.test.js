const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { createRepositories } = require("../src/repositories");
const { runMigrations } = require("../src/db/migrations");
const { createLeadService } = require("../src/services/lead-service");
const {
  handleClientText,
  handleClientMenu,
} = require("../src/handlers/client");

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
      ensureConversation(clientId, sourcePayload) {
        return repos.conversations.ensure(clientId, 1, sourcePayload);
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

test("fresh lead draft goes straight to confirm with default Telegram contact after quantity", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 703;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "quote_channel" });

  const result = service.saveQuantity({
    client: { id: clientId, username: "client703" },
    clientId,
    session: repos.sessions.get(clientId),
    rawQuantity: "3",
  });

  assert.equal(result.ok, true);
  assert.equal(result.nextStep, "confirm");
  assert.equal(result.draft.quantity, 3);
  assert.equal(result.draft.contactLabel, "Telegram: @client703");
  assert.equal(repos.sessions.get(clientId).step, "confirm");
});

test("starting a draft for the same product resumes the existing draft instead of resetting it", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 704;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "quote_channel" });
  service.saveQuantity({
    client: { id: clientId, username: "client704" },
    clientId,
    session: repos.sessions.get(clientId),
    rawQuantity: "6",
  });

  const resumed = service.startLeadDraft({
    clientId,
    product,
    sourcePayload: "quote_channel",
  });

  assert.equal(resumed.resumed, true);
  assert.equal(resumed.step, "confirm");
  assert.equal(resumed.draft.quantity, 6);
  assert.equal(repos.sessions.get(clientId).step, "confirm");
});

test("goBack from confirm returns user to quantity in adaptive lead flow", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 705;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "quote_channel" });
  service.saveQuantity({
    client: { id: clientId, username: "client705" },
    clientId,
    session: repos.sessions.get(clientId),
    rawQuantity: "2",
  });

  const previousStep = service.goBack(clientId, repos.sessions.get(clientId));
  assert.equal(previousStep, "quantity");
  assert.equal(repos.sessions.get(clientId).step, "quantity");
});

test("confirm edit quantity returns user to confirm step", () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 777;
  const product = { id: 1, code: "p1", title: "Товар" };

  service.startLeadDraft({ clientId, product, sourcePayload: "from_channel" });
  const quantitySession = service.getSession(clientId);
  service.saveQuantity({
    client: { id: clientId, username: "user777" },
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
    client: { id: clientId, username: "user777" },
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

test("client menu keeps active draft intact and offers resume CTA", async () => {
  const { repos } = createLeadServiceHarness();
  const replies = [];

  repos.sessions.set(901, "lead", "confirm", {
    productId: 1,
    productCode: "p1",
    productName: "Товар",
    quantity: 2,
    contactLabel: "Telegram: @client901",
    sourcePayload: "quote_channel",
  });

  const ctx = {
    from: { id: 901 },
    async reply(text, extra) {
      replies.push({ text, extra });
    },
  };

  await handleClientMenu(ctx, {
    repos,
    webAppUrl: "https://miniapp.example",
  });

  const session = repos.sessions.get(901);
  assert.equal(session.flow, "lead");
  assert.equal(session.step, "confirm");
  assert.match(JSON.stringify(replies[0].extra), /Продолжить заявку/);
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
    client: { id: clientId, username: "user888" },
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
    client: { id: clientId, username: "user889" },
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

test("confirmLead creates a lead, records a system message and clears the session", async () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 901;

  repos.users.upsert({
    telegram_id: clientId,
    username: "client901",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const product = { id: 1, code: "p1", title: "Товар" };
  service.startLeadDraft({ clientId, product, sourcePayload: "from_channel" });
  service.saveQuantity({
    client: { id: clientId, username: "client901" },
    clientId,
    session: service.getSession(clientId),
    rawQuantity: "2",
  });
  service.skipComment({ clientId, session: service.getSession(clientId) });
  service.useTelegramContact({
    client: { id: clientId, username: "client901" },
    session: service.getSession(clientId),
  });

  const lead = await service.confirmLead({
    client: { id: clientId, username: "client901", first_name: "Client" },
    chatId: clientId,
  });

  assert.equal(lead.product_code, "p1");
  assert.equal(lead.quantity, 2);
  assert.equal(repos.sessions.get(clientId), null);

  const latestLead = repos.leads.getLatestByClient(clientId);
  assert.equal(latestLead.id, lead.id);

  const messages = repos.messages.listByConversation(1, 10);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message_text, /Создана заявка/);
});

test("confirmLead returns duplicate metadata when an open lead already exists", async () => {
  const { repos, service } = createLeadServiceHarness();
  const clientId = 902;

  repos.users.upsert({
    telegram_id: clientId,
    username: "client902",
    first_name: "Client",
    last_name: null,
    role: "client",
  });

  const existingLead = repos.leads.create({
    client_telegram_id: clientId,
    product_code: "p1",
    product_name: "Товар",
    quantity: 1,
    comment: "",
    contact_label: "Telegram: @client902",
    source_payload: "from_channel",
    status: "new",
  });

  repos.sessions.set(clientId, "lead", "confirm", {
    productId: 1,
    productCode: "p1",
    productName: "Товар",
    quantity: 3,
    comment: "",
    contactLabel: "Telegram: @client902",
    sourcePayload: "from_channel",
  });

  const result = await service.confirmLead({
    client: { id: clientId, username: "client902", first_name: "Client" },
    chatId: clientId,
  });

  assert.deepEqual(result, {
    duplicate: true,
    existingLead,
  });
  assert.equal(repos.sessions.get(clientId).step, "confirm");
});
