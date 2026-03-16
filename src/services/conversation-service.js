const { adminClientMessageKeyboard } = require("../ui/keyboards");
const {
  adminClientCard,
  clientReceivedAdminMessage,
} = require("../ui/messages");
const { formatClientLabel } = require("../utils/formatters");
const { safeSendMessage } = require("../utils/telegram");

function createConversationService({ repos, bot, adminId }) {
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
    const conversation = ensureConversation(client.id, sourcePayload);
    repos.messages.create(conversation.id, "client", client.id, text);

    const clientLabel = formatClientLabel(client, chatId);
    await safeSendMessage(
      bot,
      adminId,
      adminClientCard(clientLabel, text, sourcePayload),
      adminClientMessageKeyboard(client.id),
    );

    return conversation;
  }

  async function sendAdminReply({ adminTelegramId, clientId, text }) {
    const conversation = ensureConversation(clientId);
    repos.messages.create(conversation.id, "admin", adminTelegramId, text);
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
