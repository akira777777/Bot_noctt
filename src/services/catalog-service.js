function createCatalogService({ repos }) {
  function listProducts() {
    return repos.products.list();
  }

  function getProductById(productId) {
    return repos.products.getById(productId);
  }

  return {
    listProducts,
    getProductById,
  };
}

module.exports = {
  createCatalogService,
};
