const test = require("node:test");
const assert = require("node:assert/strict");

const {
  welcomeMessage,
  helpMessage,
  howToOrderMessage,
  askQuantityMessage,
  askCommentMessage,
  askContactMessage,
  askCustomContactMessage,
  leadSummaryMessage,
  leadCreatedMessage,
  contactManagerMessage,
  clientMessageDelivered,
  adminSelectedClientMessage,
  adminNoClientSelectedMessage,
  adminClientCard,
  adminLeadCard,
  clientReceivedAdminMessage,
  clientLeadTakenMessage,
  clientLeadClosedMessage,
  clientLeadCalledBackMessage,
  clientLeadAwaitingPaymentMessage,
  clientLeadFulfilledMessage,
  conversationResolvedMessage,
  rateLimitMessage,
  clientLeadStatusMessage,
} = require("../src/ui/messages");
const {
  backToMainKeyboard,
  clientMiniAppKeyboard,
  catalogKeyboard,
  productCardKeyboard,
  quantityKeyboard,
  commentKeyboard,
  contactKeyboard,
  customContactKeyboard,
  confirmLeadKeyboard,
  adminClientMessageKeyboard,
  adminLeadKeyboard,
  adminQuickReplyKeyboard,
  adminInboxKeyboard,
} = require("../src/ui/keyboards");
const {
  getUserDisplayName,
  formatSourceLabel,
  formatClientLabel,
  formatConversationRow,
  formatLeadRow,
} = require("../src/utils/formatters");
const {
  parseSourcePayload,
  resolveStartAction,
} = require("../src/utils/source-payload");
const {
  clientHomeReplyKeyboard,
  removeReplyKeyboard,
} = require("../src/ui/reply-keyboards");
const {
  buildCatalogIntro,
  buildProductCard,
} = require("../src/ui/catalog-view");

test("message builders render lead and admin text variants", () => {
  assert.match(welcomeMessage({ source: "channel", title: "Из канала" }), /Из канала/);
  assert.match(welcomeMessage(), /Здравствуйте/);
  assert.match(helpMessage(), /\/status/);
  assert.match(howToOrderMessage(), /Как оформить заказ/);
  assert.match(askQuantityMessage({ title: "Товар" }), /Вы выбрали "Товар"/);
  assert.match(askCommentMessage(), /Оставить без комментария/);
  assert.match(askContactMessage(), /Как с вами удобнее связаться/);
  assert.match(askCustomContactMessage(), /@username/);
  assert.match(
    leadSummaryMessage({
      productName: "Товар",
      quantity: 2,
      comment: "",
      contactLabel: "",
      sourcePayload: "catalog_channel",
    }),
    /Без комментария/,
  );
  assert.match(leadCreatedMessage(), /Заявка отправлена/);
  assert.match(contactManagerMessage(), /любой товар или услуга/);
  assert.match(clientMessageDelivered(), /Сообщение отправлено менеджеру/);
  assert.match(adminSelectedClientMessage(12), /клиентом 12 открыт/);
  assert.match(adminNoClientSelectedMessage(), /ни один клиент не выбран/);
  assert.match(
    adminClientCard("@client", "Нужна цена", "support_channel", 4),
    /Сообщений в диалоге: 4/,
  );
  assert.match(
    adminLeadCard(
      {
        product_name: "Товар",
        quantity: 5,
        comment: "",
        contact_label: "",
        source_payload: "from_channel",
        status: "new",
      },
      "@client",
    ),
    /Статус: Новая/,
  );
  assert.match(clientReceivedAdminMessage("Ответ"), /Ответ/);
  assert.match(clientLeadTakenMessage(), /в работу/);
  assert.match(clientLeadClosedMessage(), /закрыта/);
  assert.match(clientLeadCalledBackMessage(), /ближайшее время/);
  assert.match(clientLeadAwaitingPaymentMessage(), /Ожидаем оплату/);
  assert.match(clientLeadFulfilledMessage(), /Спасибо за покупку/);
  assert.match(conversationResolvedMessage(), /обработан и закрыт/);
  assert.match(rateLimitMessage(), /слишком часто/);
  assert.match(clientLeadStatusMessage(null), /пока нет ни одной заявки/);
  assert.match(
    clientLeadStatusMessage({
      id: 10,
      status: "called_back",
      product_name: "Товар",
      quantity: 1,
      comment: "",
      contact_label: "",
      created_at: "2026-03-23 10:00:00",
    }),
    /Перезвонили/,
  );
});

test("formatter and source helpers normalize labels and fallback values", () => {
  assert.equal(getUserDisplayName(null), "Неизвестный пользователь");
  assert.equal(getUserDisplayName({ username: "alice" }), "@alice");
  assert.equal(
    getUserDisplayName({ first_name: "Alice", last_name: "Doe" }),
    "Alice Doe",
  );
  assert.match(
    getUserDisplayName({ telegram_id: 55 }),
    /Пользователь 55/,
  );

  assert.equal(formatSourceLabel(null), "Прямой вход");
  assert.equal(formatSourceLabel("quote_channel"), "Канал: заявка");
  assert.equal(formatSourceLabel("custom"), "Источник: custom");
  assert.match(
    formatClientLabel({ username: "alice", telegram_id: 11 }, 22),
    /@alice \(id: 11, chat: 22\)/,
  );
  assert.match(
    formatConversationRow({
      username: "alice",
      client_telegram_id: 11,
      status: "open",
      source_payload: "support_channel",
      last_message_text: "Очень длинное сообщение".repeat(10),
    }),
    /Канал: поддержка/,
  );
  assert.match(
    formatLeadRow({
      id: 1,
      product_name: "Товар",
      quantity: 2,
      username: "alice",
      status: "fulfilled",
      source_payload: "catalog_channel",
    }),
    /Выполнена/,
  );

  assert.deepEqual(parseSourcePayload("support_channel"), {
    raw: "support_channel",
    source: "channel",
    intent: "support",
    title: "Связь с менеджером из канала",
  });
  assert.equal(parseSourcePayload("weird_channel").source, "channel");
  assert.equal(resolveStartAction({ intent: "catalog" }), "catalog");
  assert.equal(resolveStartAction({ intent: "lead" }), "lead");
  assert.equal(resolveStartAction({ intent: "support" }), "support");
  assert.equal(resolveStartAction({ intent: "generic" }), "menu");
});

test("keyboard builders expose expected callback and web app actions", () => {
  assert.equal(
    backToMainKeyboard().reply_markup.inline_keyboard[0][0].callback_data,
    "menu:main",
  );
  const miniAppKeyboard = clientMiniAppKeyboard("https://example.com/app");
  assert.equal(
    miniAppKeyboard.reply_markup.inline_keyboard[0][0].web_app.url,
    "https://example.com/app",
  );
  assert.equal(
    catalogKeyboard([{ id: 7, title: "Товар" }]).reply_markup.inline_keyboard[0][0]
      .callback_data,
    "catalog:product:7",
  );
  assert.equal(
    productCardKeyboard(5).reply_markup.inline_keyboard[0][0].callback_data,
    "lead:product:5",
  );
  assert.equal(
    quantityKeyboard().reply_markup.inline_keyboard[0][0].callback_data,
    "lead:back",
  );
  assert.equal(
    commentKeyboard().reply_markup.inline_keyboard[0][0].callback_data,
    "lead:skip_comment",
  );
  assert.equal(
    contactKeyboard().reply_markup.inline_keyboard[0][0].callback_data,
    "lead:contact_telegram",
  );
  assert.equal(
    customContactKeyboard().reply_markup.inline_keyboard[0][1].callback_data,
    "lead:cancel",
  );
  assert.equal(
    confirmLeadKeyboard().reply_markup.inline_keyboard[0][0].callback_data,
    "lead:confirm",
  );
  assert.equal(
    adminClientMessageKeyboard(15).reply_markup.inline_keyboard[0][0].callback_data,
    "admin:reply:15",
  );
  assert.equal(
    adminLeadKeyboard(3, 44).reply_markup.inline_keyboard[0][0].callback_data,
    "admin:dialog:44",
  );
  assert.equal(
    adminQuickReplyKeyboard(12).reply_markup.inline_keyboard[0][0].callback_data,
    "admin:template:ack:12",
  );
  assert.match(
    adminInboxKeyboard([{ username: "alice", client_telegram_id: 7 }]).reply_markup
      .inline_keyboard[0][0].text,
    /@alice/,
  );
});

test("reply keyboards and catalog views render primary user flows", () => {
  assert.equal(
    clientHomeReplyKeyboard().reply_markup.keyboard[0][0],
    "🛍 Оставить заявку",
  );
  assert.equal(
    clientHomeReplyKeyboard("https://example.com/app").reply_markup.keyboard[0][0]
      .web_app.url,
    "https://example.com/app",
  );
  assert.equal(
    clientHomeReplyKeyboard(null, { hasActiveLeadDraft: true }).reply_markup
      .keyboard[0][0],
    "▶️ Продолжить заявку",
  );
  assert.deepEqual(removeReplyKeyboard().reply_markup, { remove_keyboard: true });

  assert.match(buildCatalogIntro([]), /Каталог пока пуст/);
  assert.match(
    buildCatalogIntro([{ title: "Товар", price_text: "100 USDT" }]),
    /100 USDT/,
  );
  assert.match(
    buildProductCard({
      title: "Товар",
      description: "Описание",
      price_text: "100 USDT",
    }),
    /Стоимость: 100 USDT/,
  );
});
