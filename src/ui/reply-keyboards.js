const { Markup } = require("telegraf");

function clientHomeReplyKeyboard() {
  return Markup.keyboard([["💬 Что вас интересует?"]]).resize();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

module.exports = {
  clientHomeReplyKeyboard,
  removeReplyKeyboard,
};
