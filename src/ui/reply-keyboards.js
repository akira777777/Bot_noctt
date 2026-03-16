const { Markup } = require("telegraf");

function clientHomeReplyKeyboard() {
  return Markup.keyboard([
    ["Оставить заявку", "Каталог"],
    ["Связаться с менеджером", "Как оформить заказ"],
  ]).resize();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

module.exports = {
  clientHomeReplyKeyboard,
  removeReplyKeyboard,
};
