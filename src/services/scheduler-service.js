const { getLeadStatusLabel } = require("../domain/lead-status");
const { logInfo, logError } = require("../utils/logger");

function createSchedulerService({ repos, bot, adminId }) {
  // Notify admin about leads stuck in "new" status for > 2 hours
  async function checkStaleLeads() {
    const staleLeads = repos.leads.listStale("new", 120, 10);
    if (staleLeads.length === 0) {
      return;
    }

    const lines = staleLeads.map((l) => {
      const name = l.first_name || l.username || `id:${l.client_telegram_id}`;
      return `  #${l.id} — ${l.product_name} (${name})`;
    });

    const text =
      `⏰ Необработанные заявки (${staleLeads.length}):\n\n` +
      lines.join("\n") +
      "\n\nЭти заявки ждут больше 2 часов.";

    try {
      await bot.telegram.sendMessage(adminId, text);
      logInfo("stale_leads_notification_sent", { count: staleLeads.length });
    } catch (error) {
      logError("Failed to send stale leads notification", error);
    }
  }

  // Remind admin about leads in "in_progress" with no update for > 24 hours
  async function sendFollowUps() {
    const staleLeads = repos.leads.listStale("in_progress", 1440, 10);
    if (staleLeads.length === 0) {
      return;
    }

    const lines = staleLeads.map((l) => {
      const name = l.first_name || l.username || `id:${l.client_telegram_id}`;
      return `  #${l.id} — ${l.product_name} (${name})`;
    });

    const text =
      `🔔 Заявки без обновлений > 24 часов (${staleLeads.length}):\n\n` +
      lines.join("\n") +
      "\n\nРекомендуем связаться с клиентом или обновить статус.";

    try {
      await bot.telegram.sendMessage(adminId, text);
      logInfo("follow_up_notification_sent", { count: staleLeads.length });
    } catch (error) {
      logError("Failed to send follow-up notification", error);
    }
  }

  return {
    checkStaleLeads,
    sendFollowUps,
  };
}

module.exports = { createSchedulerService };
