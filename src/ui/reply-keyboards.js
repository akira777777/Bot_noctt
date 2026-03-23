const { Markup } = require("telegraf");

function clientHomeReplyKeyboard(
  webAppUrl = null,
  { hasActiveLeadDraft = false } = {},
) {
  const rows = [];

  if (hasActiveLeadDraft) {
    rows.push(["▶️ Продолжить заявку"]);
  }

  rows.push(["🛍 Оставить заявку", "📚 Каталог"]);
  rows.push(["💬 Что вас интересует?"]);

  if (webAppUrl) {
    rows.unshift([
      { text: "📱 Открыть мини-приложение", web_app: { url: webAppUrl } },
    ]);
  }

  return Markup.keyboard(rows).resize();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

module.exports = {
  clientHomeReplyKeyboard,
  removeReplyKeyboard,
};
