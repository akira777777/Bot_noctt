const { Markup } = require("telegraf");

function clientHomeReplyKeyboard(webAppUrl = null) {
  if (!webAppUrl) {
    return Markup.keyboard([["💬 Что вас интересует?"]]).resize();
  }

  return Markup.keyboard([
    [{ text: "📱 Открыть мини-приложение", web_app: { url: webAppUrl } }],
    ["💬 Что вас интересует?"],
  ]).resize();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

module.exports = {
  clientHomeReplyKeyboard,
  removeReplyKeyboard,
};
