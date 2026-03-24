const CATALOG_PAGE_SIZE = 6;

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

function buildCatalogIntroPage(
  allProducts,
  page,
  pageSize = CATALOG_PAGE_SIZE,
) {
  if (!allProducts.length) {
    return buildCatalogIntro(allProducts);
  }
  const totalPages = Math.max(1, Math.ceil(allProducts.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = allProducts.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const list = slice.map((p) => `• ${p.title} — ${p.price_text}`).join("\n");
  return (
    `Каталог товаров (стр. ${safePage + 1} из ${totalPages}).\n\n` +
    list +
    "\n\nВыберите товар ниже, чтобы посмотреть описание, добавить в корзину или оформить заявку на один товар."
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
  buildCatalogIntroPage,
  buildProductCard,
  CATALOG_PAGE_SIZE,
};
