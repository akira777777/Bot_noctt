const { logInfo, logError } = require("../utils/logger");
const { leadResumeKeyboard } = require("../ui/keyboards");

function createSchedulerService({ repos, bot, adminId }) {
  async function sendDraftReminders() {
    const reminderConfigs = [
      {
        key: "15m",
        text: (session) =>
          `У вас осталась незавершённая заявка на "${session.draft.productName}".\n\nНажмите «Продолжить заявку», и бот вернёт вас к черновику.`,
      },
      {
        key: "24h",
        text: (session) =>
          `Ваша заявка на "${session.draft.productName}" всё ещё ждёт подтверждения.\n\nЕсли запрос актуален, продолжите оформление в один тап.`,
      },
    ];

    for (const reminder of reminderConfigs) {
      const drafts = repos.sessions.listLeadDraftsPendingReminder(reminder.key);
      for (const session of drafts) {
        try {
          await bot.telegram.sendMessage(
            session.telegram_id,
            reminder.text(session),
            leadResumeKeyboard(),
          );
          repos.sessions.markReminderSent(session.telegram_id, reminder.key);
          if (reminder.key === "15m" && repos.leadEvents) {
            try {
              repos.leadEvents.create({
                leadId: null,
                clientTelegramId: session.telegram_id,
                eventType: "lead_abandoned",
                sourcePayload: session.draft.sourcePayload || null,
                metadata: { reminder_key: reminder.key },
              });
            } catch (error) {
              logError("Failed to persist abandonment event", error);
            }
          }
          logInfo("draft_reminder_sent", {
            telegramId: session.telegram_id,
            reminderKey: reminder.key,
          });
        } catch (error) {
          logError("Failed to send draft reminder", error);
        }
      }
    }
  }

  async function sendSlaReminders() {
    const reminderConfigs = [
      { key: "15m", label: "15 минут" },
      { key: "60m", label: "60 минут" },
    ];

    for (const reminder of reminderConfigs) {
      const leads = repos.leads.listPendingSlaReminder(reminder.key, 20);
      if (leads.length === 0) {
        continue;
      }

      const lines = leads.map(
        (lead) =>
          `  #${lead.id} — ${lead.product_name} — ${lead.first_name || lead.username || `id:${lead.client_telegram_id}`}`,
      );

      try {
        await bot.telegram.sendMessage(
          adminId,
          `SLA ${reminder.label}: заявки без первого ответа\n\n${lines.join("\n")}`,
        );
        for (const lead of leads) {
          repos.leads.markSlaReminderSent(lead.id, reminder.key);
        }
      } catch (error) {
        logError("Failed to send SLA reminder", error);
      }
    }
  }

  async function sendDueFollowUpReminders() {
    const leads = repos.leads.listDueFollowUps(20);
    if (leads.length === 0) {
      return;
    }

    const lines = leads.map(
      (lead) =>
        `  #${lead.id} — ${lead.product_name} — ${lead.first_name || lead.username || `id:${lead.client_telegram_id}`}`,
    );

    try {
      await bot.telegram.sendMessage(
        adminId,
        `follow-up: пришло время вернуться к лидам\n\n${lines.join("\n")}`,
      );
      for (const lead of leads) {
        repos.leads.markFollowUpReminderSent(lead.id);
      }
    } catch (error) {
      logError("Failed to send follow-up reminders", error);
    }
  }

  async function checkStaleLeads() {
    await sendSlaReminders();
  }

  async function sendFollowUps() {
    await sendDueFollowUpReminders();
  }

  return {
    sendDraftReminders,
    sendSlaReminders,
    sendDueFollowUpReminders,
    checkStaleLeads,
    sendFollowUps,
  };
}

module.exports = { createSchedulerService };
