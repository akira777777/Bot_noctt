const { logError } = require('./logger');

async function safeSendMessage(bot, chatId, text, extra = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (error) {
    logError(`Failed to send message to chat ${chatId}`, error);
    return null;
  }
}

async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (error) {
    logError(`Failed to reply to user ${ctx.from?.id}`, error);
    return null;
  }
}

async function safeEditMessageReplyMarkup(ctx, keyboard) {
  try {
    return await ctx.editMessageReplyMarkup(keyboard);
  } catch (_) {
    // Silent fail - message might not be editable
  }
}

async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (error) {
    logError('Failed to answer callback query', error);
  }
}

module.exports = {
  safeSendMessage,
  safeReply,
  safeEditMessageReplyMarkup,
  safeAnswerCbQuery,
};

