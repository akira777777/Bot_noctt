const DEFAULT_QUICK_TEMPLATES = {
  price:
    "По цене сориентирую вас в личном порядке. Напишите, какой товар вас интересует, и я пришлю актуальные условия.",
  terms:
    "По срокам всё зависит от выбранной позиции и объёма. Уточните заказ, и я сразу сориентирую по времени.",
  payment:
    "Оплата обсуждается после уточнения деталей заказа. При необходимости расскажу доступные варианты.",
  delivery:
    "По доставке подберём удобный вариант после подтверждения заказа и адреса получения.",
};

function createAdminService({ repos, templates = DEFAULT_QUICK_TEMPLATES }) {
  function upsertAdmin(from) {
    repos.users.upsert({
      telegram_id: from.id,
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      role: "admin",
    });

    return repos.users.getById(from.id);
  }

  function getActiveClientId(adminTelegramId) {
    const state = repos.adminState.get(adminTelegramId);
    return state?.active_client_telegram_id || null;
  }

  function selectClient(adminTelegramId, clientId) {
    repos.adminState.setActiveClient(adminTelegramId, clientId);
    return clientId;
  }

  function clearSelectedClient(adminTelegramId) {
    repos.adminState.clear(adminTelegramId);
  }

  function listRecentDialogs(limit = 10) {
    return repos.conversations.listRecent(limit);
  }

  function listRecentLeads(limit = 10) {
    return repos.leads.list(limit);
  }

  function getLatestLeadByClient(clientId) {
    return repos.leads.getLatestByClient(clientId);
  }

  function takeLead(leadId) {
    return repos.leads.updateStatus(leadId, "in_progress");
  }

  function closeLead(leadId) {
    return repos.leads.updateStatus(leadId, "closed");
  }

  function markLeadCalledBack(leadId) {
    return repos.leads.updateStatus(leadId, "called_back");
  }

  function markLeadAwaitingPayment(leadId) {
    return repos.leads.updateStatus(leadId, "awaiting_payment");
  }

  function markLeadFulfilled(leadId) {
    return repos.leads.updateStatus(leadId, "fulfilled");
  }

  function getTemplate(templateKey) {
    return templates[templateKey] || null;
  }

  function listAllProducts() {
    return repos.products.listAll();
  }

  function addProduct({ code, title, description, price_text, sort_order }) {
    const existing = repos.products.getByCode(code);
    if (existing) {
      return { ok: false, error: `Товар с кодом "${code}" уже существует.` };
    }
    const product = repos.products.create({
      code,
      title,
      description: description || "",
      price_text: price_text || "",
      sort_order: sort_order || 0,
    });
    return { ok: true, product };
  }

  function editProduct({ id, title, description, price_text, sort_order }) {
    const existing = repos.products.getById(id);
    if (!existing) {
      return { ok: false, error: `Товар #${id} не найден.` };
    }
    const product = repos.products.update({
      id,
      title: title !== undefined ? title : existing.title,
      description:
        description !== undefined ? description : existing.description,
      price_text: price_text !== undefined ? price_text : existing.price_text,
      sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
    });
    return { ok: true, product };
  }

  function toggleProduct(id) {
    const existing = repos.products.getById(id);
    if (!existing) {
      return { ok: false, error: `Товар #${id} не найден.` };
    }
    const product = repos.products.setActive(id, !existing.is_active);
    return { ok: true, product };
  }

  function getStats() {
    const total = repos.stats.totalLeads();
    const byStatus = repos.stats.leadCountsByStatus();
    const topProducts = repos.stats.topProductsByLeads(5);
    return { total, byStatus, topProducts };
  }

  function getClientHistory(clientTelegramId, limit = 10) {
    const conversation = repos.conversations.getByClientId(clientTelegramId);
    if (!conversation) {
      return { ok: false, error: "Диалог для этого клиента не найден." };
    }
    const messages = repos.messages.listByConversation(conversation.id, limit);
    return { ok: true, messages: messages.reverse() };
  }

  function exportLeadsCsv() {
    const leads = repos.leads.listAll();

    const headers = [
      "id",
      "status",
      "product_code",
      "product_name",
      "quantity",
      "comment",
      "contact_label",
      "client_telegram_id",
      "username",
      "first_name",
      "last_name",
      "source_payload",
      "created_at",
      "updated_at",
    ];

    function escapeCsv(value) {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const rows = leads.map((l) =>
      headers.map((h) => escapeCsv(l[h])).join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    return { ok: true, csv, count: leads.length };
  }

  function searchUser(query) {
    const byId = Number(query);
    if (byId && !isNaN(byId)) {
      const user = repos.users.getById(byId);
      return user ? { ok: true, user } : { ok: false, reason: "not_found" };
    }
    const user = repos.users.getByUsername(query);
    return user ? { ok: true, user } : { ok: false, reason: "not_found" };
  }

  async function broadcastToClients(bot, text) {
    const clients = repos.users.listClients();
    let sent = 0;
    let failed = 0;
    for (const client of clients) {
      try {
        await bot.telegram.sendMessage(client.telegram_id, text);
        sent++;
      } catch (_) {
        failed++;
      }
    }
    return { total: clients.length, sent, failed };
  }

  function resolveConversation(clientTelegramId) {
    const conversation = repos.conversations.getByClientId(clientTelegramId);
    if (!conversation) return { ok: false, reason: "not_found" };
    if (conversation.status === "closed") return { ok: false, reason: "already_closed" };
    repos.conversations.close(clientTelegramId);
    return { ok: true };
  }

  function blockUser(telegramId) {
    const user = repos.users.getById(telegramId);
    if (!user) return { ok: false, reason: "not_found" };
    if (user.is_blocked) return { ok: false, reason: "already_blocked" };
    repos.users.block(telegramId);
    return { ok: true };
  }

  function unblockUser(telegramId) {
    const user = repos.users.getById(telegramId);
    if (!user) return { ok: false, reason: "not_found" };
    if (!user.is_blocked) return { ok: false, reason: "not_blocked" };
    repos.users.unblock(telegramId);
    return { ok: true };
  }

  return {
    upsertAdmin,
    getActiveClientId,
    selectClient,
    clearSelectedClient,
    listRecentDialogs,
    listRecentLeads,
    getLatestLeadByClient,
    takeLead,
    closeLead,
    markLeadCalledBack,
    markLeadAwaitingPayment,
    markLeadFulfilled,
    getTemplate,
    templates,
    listAllProducts,
    addProduct,
    editProduct,
    toggleProduct,
    getClientHistory,
    getStats,
    exportLeadsCsv,
    searchUser,
    broadcastToClients,
    resolveConversation,
    blockUser,
    unblockUser,
  };
}

module.exports = {
  createAdminService,
  DEFAULT_QUICK_TEMPLATES,
};
