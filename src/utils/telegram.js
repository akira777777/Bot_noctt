const { logError } = require('./logger');

async function safeSendMessage(bot, chatId, text, extra = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (error) {
    logError(`Failed to send message to chat ${chatId}`, error);
    return null;
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
  safeAnswerCbQuery,
};

