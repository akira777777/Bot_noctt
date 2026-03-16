function buildCatalogIntro(products) {
  if (!products.length) {
    return "Каталог пока пуст. Напишите менеджеру, и мы подберём вариант вручную.";
  }

  const list = products.map((p) => `• ${p.title} — ${p.price_text}`).join("\n");

  return (
    "Каталог товаров.\n\n" +
    list +
    "\n\nВыберите товар ниже, чтобы посмотреть описание и перейти к заявке."
  );
}

function buildProductCard(product) {
  return (
    `${product.title}\n\n` +
    `${product.description}\n\n` +
    `Стоимость: ${product.price_text}`
  );
}

module.exports = {
  buildCatalogIntro,
  buildProductCard,
};
