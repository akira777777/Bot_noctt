const {
  clientLeadTakenMessage,
  clientLeadClosedMessage,
  clientLeadOutOfStockMessage,
  clientLeadNotRelevantMessage,
  clientLeadCalledBackMessage,
  clientLeadProposalSentMessage,
  clientLeadFulfilledMessage,
} = require("../ui/messages");
const {
  isCanonicalLeadStatus,
  normalizeLeadStatus,
} = require("../domain/lead-status");
const { safeSendMessage } = require("../utils/telegram");

const STATUS_NOTIFICATIONS = Object.freeze({
  in_progress: clientLeadTakenMessage,
  closed: clientLeadClosedMessage,
  called_back: clientLeadCalledBackMessage,
  proposal_sent: clientLeadProposalSentMessage,
  fulfilled: clientLeadFulfilledMessage,
});

const CLOSED_REASON_NOTIFICATIONS = Object.freeze({
  out_of_stock: clientLeadOutOfStockMessage,
  not_relevant: clientLeadNotRelevantMessage,
});

function createLeadStatusService({ repos, bot = null }) {
  async function updateStatus(leadId, status, options = {}) {
    const normalizedStatus = normalizeLeadStatus(status);
    if (!normalizedStatus || !isCanonicalLeadStatus(normalizedStatus)) {
      return null;
    }

    const lead = repos.leads.updateStatus(leadId, normalizedStatus, options);
    if (!lead) {
      return null;
    }

    if (normalizedStatus === "closed" && repos.leadEvents) {
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
      normalizedStatus === "closed" && lead.closed_reason
        ? CLOSED_REASON_NOTIFICATIONS[lead.closed_reason] ||
          STATUS_NOTIFICATIONS[normalizedStatus]
        : STATUS_NOTIFICATIONS[normalizedStatus];
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
