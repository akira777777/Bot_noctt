const { adminClientMessageKeyboard } = require("../ui/keyboards");
const {
  adminClientCard,
  clientReceivedAdminMessage,
} = require("../ui/messages");
const { formatClientLabel } = require("../utils/formatters");
const { safeSendMessage } = require("../utils/telegram");

function createConversationService({ repos, bot, adminId, aiService = null }) {
  function ensureTelegramDeliveryAvailable() {
    if (!bot?.telegram?.sendMessage) {
      const error = new Error("Telegram delivery is disabled");
      error.code = "TELEGRAM_DELIVERY_DISABLED";
      throw error;
    }
  }

  function upsertTelegramUser(from, role) {
    repos.users.upsert({
      telegram_id: from.id,
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      role,
    });

    return repos.users.getById(from.id);
  }

  function ensureConversation(clientTelegramId, sourcePayload = null) {
    return repos.conversations.ensure(clientTelegramId, adminId, sourcePayload);
  }

  async function forwardClientMessage({ client, chatId, text, sourcePayload }) {
    ensureTelegramDeliveryAvailable();
    const conversation = ensureConversation(client.id, sourcePayload);

    // Fetch history before saving so the current message isn't included twice
    // (ai-service appends clientMessage separately as the final user turn)
    const recentMessagesForAi = aiService?.isEnabled
      ? repos.messages.listByConversation(conversation.id, 6).reverse()
      : null;

    repos.messages.create(conversation.id, "client", client.id, text);
    repos.leads.touchLastClientActivityByClient(client.id);

    const msgCount = repos.messages.countByConversation(conversation.id);
    const clientLabel = formatClientLabel(client, chatId);
    await safeSendMessage(
      bot,
      adminId,
      adminClientCard(clientLabel, text, sourcePayload, msgCount),
      adminClientMessageKeyboard(client.id),
    );

    // AI auto-reply: send an immediate response while admin reviews
    if (aiService?.isEnabled) {
      try {
        const recentMessages = recentMessagesForAi;
        const products = repos.products.list();
        const aiReply = await aiService.generateClientAutoReply({
          products,
          conversationMessages: recentMessages,
          clientMessage: text,
        });
        if (aiReply) {
          repos.messages.create(conversation.id, "admin", adminId, aiReply);
          await safeSendMessage(bot, client.id, `🤖 ${aiReply}`);
        }
      } catch (_) {}
    }

    return conversation;
  }

  async function sendAdminReply({ adminTelegramId, clientId, text }) {
    ensureTelegramDeliveryAvailable();
    const conversation = ensureConversation(clientId);
    repos.messages.create(conversation.id, "admin", adminTelegramId, text);
    const firstReplyResult = repos.leads.recordFirstAdminReplyByClient(clientId);
    if (firstReplyResult.updated && repos.leadEvents) {
      repos.leadEvents.create({
        leadId: firstReplyResult.lead.id,
        clientTelegramId: clientId,
        eventType: "admin_first_reply",
        sourcePayload: firstReplyResult.lead.source_payload || null,
      });
    }
    await safeSendMessage(bot, clientId, clientReceivedAdminMessage(text));
    return conversation;
  }

  return {
    upsertTelegramUser,
    ensureConversation,
    forwardClientMessage,
    sendAdminReply,
  };
}

module.exports = {
  createConversationService,
};
