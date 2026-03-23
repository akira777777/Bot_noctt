const { Markup } = require("telegraf");
const {
  adminQuickReplyKeyboard,
  adminInboxKeyboard,
} = require("../ui/keyboards");
const {
  adminSelectedClientMessage,
  adminNoClientSelectedMessage,
  clientLeadTakenMessage,
  clientLeadClosedMessage,
  clientLeadCalledBackMessage,
  clientLeadAwaitingPaymentMessage,
  clientLeadFulfilledMessage,
  conversationResolvedMessage,
} = require("../ui/messages");
const { formatConversationRow, formatLeadRow } = require("../utils/formatters");
const { safeAnswerCbQuery, safeSendMessage } = require("../utils/telegram");
const { getLeadStatusLabel } = require("../domain/lead-status");
const { parseActionId } = require("../utils/actions");

function isAdmin(ctx, deps) {
  return ctx.from.id === deps.adminId;
}

async function replaceWithStatusButton(ctx, text) {
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [[{ text, callback_data: "admin:noop" }]],
    });
  } catch (_) {}
}

async function selectClient(ctx, deps, clientId) {
  deps.services.admin.selectClient(ctx.from.id, clientId);
  await ctx.reply(
    adminSelectedClientMessage(clientId),
    adminQuickReplyKeyboard(clientId),
  );
}

async function sendAdminReply(ctx, deps, clientId, text) {
  await deps.services.conversation.sendAdminReply({
    adminTelegramId: ctx.from.id,
    clientId,
    text,
  });
  await ctx.reply(
    "Сообщение отправлено клиенту.",
    adminQuickReplyKeyboard(clientId),
  );
}

async function showInbox(ctx, deps, title = "Inbox") {
  const dialogs = deps.services.admin.listRecentDialogs(8);
  if (!dialogs.length) {
    await ctx.reply("Inbox пока пуст. Новые обращения появятся здесь.");
    return;
  }

  const text = [title].concat(dialogs.map(formatConversationRow)).join("\n");

  await ctx.reply(text, adminInboxKeyboard(dialogs));
}

function registerAdminCommands(bot, deps) {
  bot.command("clients", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const rows = deps.services.admin.listRecentDialogs(10);
    if (rows.length === 0) {
      await ctx.reply("Активных клиентов пока нет.");
      return;
    }

    const text = ["Последние клиенты:"]
      .concat(rows.map(formatConversationRow))
      .join("\n");

    await ctx.reply(text);
  });

  bot.command("dialogs", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    await showInbox(ctx, deps, "Последние диалоги:");
  });

  bot.command("leads", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const rows = deps.services.admin.listRecentLeads(10);
    if (rows.length === 0) {
      await ctx.reply("Заявок пока нет.");
      return;
    }

    const text = ["Последние заявки:"]
      .concat(rows.map(formatLeadRow))
      .join("\n");

    await ctx.reply(text);
  });

  bot.command("setclient", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const [, rawClientId] = ctx.message.text.split(" ");
    const clientId = Number(rawClientId);
    if (!clientId) {
      await ctx.reply("Используйте команду в формате: /setclient 123456789");
      return;
    }

    await selectClient(ctx, deps, clientId);
  });

  bot.command("stop", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    deps.services.admin.clearSelectedClient(ctx.from.id);
    await ctx.reply("Активный диалог сброшен.");
  });

  bot.command("products", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const products = deps.services.admin.listAllProducts();
    if (!products.length) {
      await ctx.reply("Товаров пока нет.");
      return;
    }

    const lines = products.map((p) => {
      const status = p.is_active ? "✅" : "❌";
      return `${status} #${p.id} [${p.code}] ${p.title} — ${p.price_text}`;
    });
    await ctx.reply("Список всех товаров:\n" + lines.join("\n"));
  });

  bot.command("addproduct", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const rawArgs = ctx.message.text.replace(/^\/addproduct\s*/, "");
    const parts = rawArgs.split("|").map((s) => s.trim());

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await ctx.reply(
        "Формат: /addproduct <код> | <название> | <описание> | <цена>\n" +
          "Пример: /addproduct widget | Виджет | Описание товара | от 100 руб.",
      );
      return;
    }

    const [code, title, description = "", price_text = ""] = parts;
    const result = deps.services.admin.addProduct({
      code,
      title,
      description,
      price_text,
      sort_order: 0,
    });

    if (!result.ok) {
      await ctx.reply(`Ошибка: ${result.error}`);
      return;
    }

    const p = result.product;
    await ctx.reply(
      `Товар добавлен ✅\n\nID: ${p.id}\nКод: ${p.code}\nНазвание: ${p.title}\nОписание: ${p.description}\nЦена: ${p.price_text}`,
    );
  });

  bot.command("editproduct", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const rawArgs = ctx.message.text.replace(/^\/editproduct\s*/, "");
    const parts = rawArgs.split("|").map((s) => s.trim());

    if (parts.length < 2 || !parts[0]) {
      await ctx.reply(
        "Формат: /editproduct <id> | <название> | <описание> | <цена>\n" +
          "Пример: /editproduct 3 | Новое название | Новое описание | от 200 руб.",
      );
      return;
    }

    const id = Number(parts[0]);
    if (!id) {
      await ctx.reply("Первым аргументом должен быть числовой ID товара.");
      return;
    }

    const [, title, description, price_text] = parts;
    const result = deps.services.admin.editProduct({
      id,
      title: title || undefined,
      description: description !== undefined ? description : undefined,
      price_text: price_text !== undefined ? price_text : undefined,
    });

    if (!result.ok) {
      await ctx.reply(`Ошибка: ${result.error}`);
      return;
    }

    const p = result.product;
    await ctx.reply(
      `Товар обновлён ✅\n\nID: ${p.id}\nКод: ${p.code}\nНазвание: ${p.title}\nОписание: ${p.description}\nЦена: ${p.price_text}`,
    );
  });

  bot.command("toggleproduct", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const [, rawId] = ctx.message.text.split(" ");
    const id = Number(rawId);
    if (!id) {
      await ctx.reply("Используйте команду в формате: /toggleproduct <id>");
      return;
    }

    const result = deps.services.admin.toggleProduct(id);
    if (!result.ok) {
      await ctx.reply(`Ошибка: ${result.error}`);
      return;
    }

    const p = result.product;
    const status = p.is_active ? "активирован ✅" : "деактивирован ❌";
    await ctx.reply(`Товар #${p.id} (${p.code}) ${status}.`);
  });

  bot.command("history", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const [, rawId] = ctx.message.text.split(" ");
    let clientId = rawId ? Number(rawId) : null;

    if (!clientId) {
      clientId = deps.services.admin.getActiveClientId(ctx.from.id);
    }

    if (!clientId) {
      await ctx.reply(
        "Укажите клиента командой /history <telegram_id> или выберите клиента через диалог.",
      );
      return;
    }

    const result = deps.services.admin.getClientHistory(clientId);
    if (!result.ok) {
      await ctx.reply(`Ошибка: ${result.error}`);
      return;
    }

    if (!result.messages.length) {
      await ctx.reply(`Сообщений для клиента ${clientId} не найдено.`);
      return;
    }

    const lines = result.messages.map((m) => {
      const who = m.sender_role === "admin" ? "👤 Админ" : "🙋 Клиент";
      const time = m.created_at ? m.created_at.slice(0, 16) : "";
      const text = m.message_text.slice(0, 200);
      return `${who} [${time}]:\n${text}`;
    });

    const header = `📋 История диалога (клиент ${clientId}), последние ${result.messages.length} сообщений:\n\n`;
    await ctx.reply(header + lines.join("\n\n—————\n\n"), {
      parse_mode: undefined,
    });
  });

  bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const { total, byStatus, topProducts } = deps.services.admin.getStats();

    const statusLines = byStatus.map((row) => {
      const label = getLeadStatusLabel(row.status);
      return `  ${label}: ${row.cnt}`;
    });

    const productLines = topProducts.map(
      (row, i) =>
        `  ${i + 1}. ${row.product_name} (${row.product_code}): ${row.cnt}`,
    );

    const text =
      `📊 Статистика по заявкам\n\n` +
      `Всего заявок: ${total}\n\n` +
      `По статусам:\n${statusLines.join("\n") || "  Нет данных"}\n\n` +
      `Топ товаров:\n${productLines.join("\n") || "  Нет данных"}`;

    await ctx.reply(text);
  });

  bot.command("exportleads", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const result = deps.services.admin.exportLeadsCsv();
    if (!result.ok) {
      await ctx.reply("Ошибка при экспорте заявок.");
      return;
    }

    if (result.count === 0) {
      await ctx.reply("Заявок пока нет — экспортировать нечего.");
      return;
    }

    const csvBuffer = Buffer.from(result.csv, "utf8");
    const now = new Date().toISOString().slice(0, 10);
    await ctx.replyWithDocument(
      { source: csvBuffer, filename: `leads_${now}.csv` },
      { caption: `Экспорт заявок (${result.count} шт.) на ${now}` },
    );
  });

  bot.command("blockuser", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const telegramId = parseInt(args[0], 10);
    if (!telegramId || isNaN(telegramId)) {
      await ctx.reply("Использование: /blockuser <telegram_id>");
      return;
    }

    const result = deps.services.admin.blockUser(telegramId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        await ctx.reply(`Пользователь ${telegramId} не найден.`);
      } else if (result.reason === "already_blocked") {
        await ctx.reply(`Пользователь ${telegramId} уже заблокирован.`);
      } else {
        await ctx.reply("Ошибка при блокировке пользователя.");
      }
      return;
    }

    await ctx.reply(`Пользователь ${telegramId} заблокирован.`);
  });

  bot.command("unblockuser", async (ctx) => {
    if (!isAdmin(ctx, deps)) {
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const telegramId = parseInt(args[0], 10);
    if (!telegramId || isNaN(telegramId)) {
      await ctx.reply("Использование: /unblockuser <telegram_id>");
      return;
    }

    const result = deps.services.admin.unblockUser(telegramId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        await ctx.reply(`Пользователь ${telegramId} не найден.`);
      } else if (result.reason === "not_blocked") {
        await ctx.reply(`Пользователь ${telegramId} не заблокирован.`);
      } else {
        await ctx.reply("Ошибка при разблокировке пользователя.");
      }
      return;
    }

    await ctx.reply(`Пользователь ${telegramId} разблокирован.`);
  });

  bot.command("search", async (ctx) => {
    if (!isAdmin(ctx, deps)) return;

    const query = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!query) {
      await ctx.reply("Использование: /search @username или /search <telegram_id>");
      return;
    }

    const result = deps.services.admin.searchUser(query);
    if (!result.ok) {
      await ctx.reply(`Пользователь "${query}" не найден.`);
      return;
    }

    const u = result.user;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
    const username = u.username ? `@${u.username}` : "—";
    const blocked = u.is_blocked ? "🚫 Заблокирован" : "✅ Активен";
    const text =
      `👤 Найден пользователь\n\n` +
      `ID: ${u.telegram_id}\n` +
      `Имя: ${name}\n` +
      `Username: ${username}\n` +
      `Роль: ${u.role}\n` +
      `Статус: ${blocked}\n` +
      `Зарегистрирован: ${u.created_at.slice(0, 10)}`;

    const { Markup: M } = require("telegraf");
    await ctx.reply(
      text,
      M.inlineKeyboard([
        [M.button.callback("Открыть диалог", `admin:dialog:${u.telegram_id}`)],
      ]),
    );
  });

  bot.command("resolve", async (ctx) => {
    if (!isAdmin(ctx, deps)) return;

    const args = ctx.message.text.split(" ").slice(1);
    let clientId = args[0] ? Number(args[0]) : null;

    if (!clientId) {
      clientId = deps.services.admin.getActiveClientId(ctx.from.id);
    }

    if (!clientId) {
      await ctx.reply(
        "Укажите клиента: /resolve <telegram_id> или выберите диалог через /dialogs",
      );
      return;
    }

    const result = deps.services.admin.resolveConversation(clientId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        await ctx.reply(`Диалог с клиентом ${clientId} не найден.`);
      } else if (result.reason === "already_closed") {
        await ctx.reply(`Диалог с клиентом ${clientId} уже закрыт.`);
      }
      return;
    }

    await deps.services.conversation.sendAdminReply({
      adminTelegramId: ctx.from.id,
      clientId,
      text: conversationResolvedMessage(),
    });

    deps.services.admin.clearSelectedClient(ctx.from.id);
    await ctx.reply(`✅ Диалог с клиентом ${clientId} закрыт. Клиент уведомлён.`);
  });

  bot.command("broadcast", async (ctx) => {
    if (!isAdmin(ctx, deps)) return;

    const text = ctx.message.text.replace(/^\/broadcast\s*/, "").trim();
    if (!text) {
      await ctx.reply(
        "Использование: /broadcast <текст сообщения>\n\n" +
          "Сообщение будет отправлено всем активным клиентам.",
      );
      return;
    }

    await ctx.reply("Отправляю рассылку...");

    const { sent, failed, total } = await deps.services.admin.broadcastToClients(
      deps.bot,
      text,
    );

    await ctx.reply(
      `📢 Рассылка завершена\n\n` +
        `Всего клиентов: ${total}\n` +
        `Доставлено: ${sent}\n` +
        `Не доставлено: ${failed}`,
    );
  });
}

async function handleAdminStart(ctx, deps) {
  deps.services.admin.upsertAdmin(ctx.from);
  const activeClientId = deps.services.admin.getActiveClientId(ctx.from.id);
  const selectedText = activeClientId
    ? `Сейчас выбран клиент: ${activeClientId}\n\n`
    : "Сейчас активный диалог не выбран.\n\n";
  const message =
    selectedText +
    "Команды администратора:\n" +
    "/clients — последние клиенты\n" +
    "/dialogs — последние диалоги\n" +
    "/leads — последние заявки\n" +
    "/setclient <id> — выбрать клиента вручную\n" +
    "/stop — сбросить активный диалог\n" +
    "/search @username|id — найти клиента\n" +
    "/resolve [id] — закрыть диалог (активный или по id)\n" +
    "/broadcast <текст> — рассылка всем клиентам\n" +
    "/history [id] — история диалога\n" +
    "/stats — статистика заявок\n" +
    "/exportleads — экспорт заявок в CSV\n" +
    "/blockuser <id> — заблокировать пользователя\n" +
    "/unblockuser <id> — разблокировать пользователя";
  const webAppKeyboard = deps.webappUrl
    ? Markup.inlineKeyboard([
        [Markup.button.webApp("Открыть Mini App админки", deps.webappUrl)],
      ])
    : undefined;

  await ctx.reply(message, webAppKeyboard);
}

async function handleAdminText(ctx, deps) {
  deps.services.admin.upsertAdmin(ctx.from);

  const clientId = deps.services.admin.getActiveClientId(ctx.from.id);
  if (!clientId) {
    await ctx.reply(adminNoClientSelectedMessage());
    return;
  }

  await sendAdminReply(ctx, deps, clientId, ctx.message.text);
}

async function handleAdminAction(ctx, deps) {
  const action = ctx.match[0];
  const adminId = ctx.from.id;

  if (!isAdmin(ctx, deps)) {
    await safeAnswerCbQuery(ctx, "Доступно только администратору");
    return;
  }

  deps.services.admin.upsertAdmin(ctx.from);

  if (action === "admin:inbox") {
    await safeAnswerCbQuery(ctx);
    await showInbox(ctx, deps, "Inbox:");
    return;
  }

  if (action === "admin:noop") {
    await safeAnswerCbQuery(ctx, "Уже обработано");
    return;
  }

  if (action.startsWith("admin:reply:") || action.startsWith("admin:dialog:")) {
    const clientId = parseActionId(action);
    await safeAnswerCbQuery(ctx, "Диалог открыт");
    await selectClient(ctx, deps, clientId);
    return;
  }

  if (action.startsWith("admin:lead_take:")) {
    const leadId = parseActionId(action);
    const lead = deps.services.admin.takeLead(leadId);
    if (!lead) {
      await safeAnswerCbQuery(ctx, "Заявка не найдена");
      return;
    }
    await safeAnswerCbQuery(ctx, "Заявка взята в работу");
    await replaceWithStatusButton(ctx, "✅ Взята в работу");
    await safeSendMessage(
      deps.bot,
      lead.client_telegram_id,
      clientLeadTakenMessage(),
    );
    await ctx.reply(`Заявка #${leadId} переведена в статус "in_progress".`);
    return;
  }

  if (action.startsWith("admin:lead_close:")) {
    const leadId = parseActionId(action);
    const lead = deps.services.admin.closeLead(leadId);
    if (!lead) {
      await safeAnswerCbQuery(ctx, "Заявка не найдена");
      return;
    }
    await safeAnswerCbQuery(ctx, "Заявка закрыта");
    await replaceWithStatusButton(ctx, "✅ Заявка закрыта");
    await safeSendMessage(
      deps.bot,
      lead.client_telegram_id,
      clientLeadClosedMessage(),
    );
    await ctx.reply(`Заявка #${leadId} переведена в статус "closed".`);
    return;
  }

  if (action.startsWith("admin:lead_called_back:")) {
    const leadId = parseActionId(action);
    const lead = deps.services.admin.markLeadCalledBack(leadId);
    if (!lead) {
      await safeAnswerCbQuery(ctx, "Заявка не найдена");
      return;
    }
    await safeAnswerCbQuery(ctx, "Статус: Перезвонили");
    await replaceWithStatusButton(ctx, "✅ Перезвонили");
    await safeSendMessage(
      deps.bot,
      lead.client_telegram_id,
      clientLeadCalledBackMessage(),
    );
    await ctx.reply(`Заявка #${leadId} переведена в статус "called_back".`);
    return;
  }

  if (action.startsWith("admin:lead_awaiting_payment:")) {
    const leadId = parseActionId(action);
    const lead = deps.services.admin.markLeadAwaitingPayment(leadId);
    if (!lead) {
      await safeAnswerCbQuery(ctx, "Заявка не найдена");
      return;
    }
    await safeAnswerCbQuery(ctx, "Статус: Ждём оплату");
    await replaceWithStatusButton(ctx, "✅ Ждём оплату");
    await safeSendMessage(
      deps.bot,
      lead.client_telegram_id,
      clientLeadAwaitingPaymentMessage(),
    );
    await ctx.reply(
      `Заявка #${leadId} переведена в статус "awaiting_payment".`,
    );
    return;
  }

  if (action.startsWith("admin:lead_fulfilled:")) {
    const leadId = parseActionId(action);
    const lead = deps.services.admin.markLeadFulfilled(leadId);
    if (!lead) {
      await safeAnswerCbQuery(ctx, "Заявка не найдена");
      return;
    }
    await safeAnswerCbQuery(ctx, "Заявка выполнена ✅");
    await replaceWithStatusButton(ctx, "✅ Выполнена");
    await safeSendMessage(
      deps.bot,
      lead.client_telegram_id,
      clientLeadFulfilledMessage(),
    );
    await ctx.reply(`Заявка #${leadId} переведена в статус "fulfilled".`);
    return;
  }

  if (action.startsWith("admin:template:")) {
    const [, , templateKey, rawClientId] = action.split(":");
    const clientId = Number(rawClientId);
    const text = deps.services.admin.getTemplate(templateKey);
    if (!text) {
      await safeAnswerCbQuery(ctx, "Шаблон не найден");
      return;
    }

    deps.services.admin.selectClient(adminId, clientId);
    await safeAnswerCbQuery(ctx, "Шаблон отправлен");
    await sendAdminReply(ctx, deps, clientId, text);
    return;
  }

  if (action === "admin:clear_dialog") {
    deps.services.admin.clearSelectedClient(adminId);
    await safeAnswerCbQuery(ctx, "Диалог сброшен");
    await ctx.reply("Активный диалог сброшен.");
  }
}

module.exports = {
  registerAdminCommands,
  handleAdminStart,
  handleAdminText,
  handleAdminAction,
};
