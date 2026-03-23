const {
  clientLeadTakenMessage,
  clientLeadClosedMessage,
  clientLeadOutOfStockMessage,
  clientLeadNotRelevantMessage,
  clientLeadCalledBackMessage,
  clientLeadAwaitingPaymentMessage,
  clientLeadFulfilledMessage,
} = require("../ui/messages");
const { isCanonicalLeadStatus } = require("../domain/lead-status");
const { safeSendMessage } = require("../utils/telegram");

const STATUS_NOTIFICATIONS = Object.freeze({
  in_progress: clientLeadTakenMessage,
  closed: clientLeadClosedMessage,
  called_back: clientLeadCalledBackMessage,
  awaiting_payment: clientLeadAwaitingPaymentMessage,
  fulfilled: clientLeadFulfilledMessage,
});

const CLOSED_REASON_NOTIFICATIONS = Object.freeze({
  out_of_stock: clientLeadOutOfStockMessage,
  not_relevant: clientLeadNotRelevantMessage,
});

function createLeadStatusService({ repos, bot = null }) {
  async function updateStatus(leadId, status, options = {}) {
    if (!isCanonicalLeadStatus(status)) {
      return null;
    }

    const lead = repos.leads.updateStatus(leadId, status, options);
    if (!lead) {
      return null;
    }

    if (status === "closed" && repos.leadEvents) {
      repos.leadEvents.create({
        leadId: lead.id,
        clientTelegramId: lead.client_telegram_id,
        eventType: "lead_closed",
        sourcePayload: lead.source_payload || null,
        metadata: {
          closed_reason: lead.closed_reason || null,
        },
      });
    }

    const notificationFactory =
      status === "closed" && lead.closed_reason
        ? CLOSED_REASON_NOTIFICATIONS[lead.closed_reason] ||
          STATUS_NOTIFICATIONS[status]
        : STATUS_NOTIFICATIONS[status];
    if (
      options.notifyClient !== false &&
      notificationFactory &&
      bot?.telegram?.sendMessage &&
      Number.isInteger(lead.client_telegram_id) &&
      lead.client_telegram_id > 0
    ) {
      await safeSendMessage(bot, lead.client_telegram_id, notificationFactory());
    }

    return lead;
  }

  return {
    updateStatus,
  };
}

module.exports = {
  createLeadStatusService,
};
