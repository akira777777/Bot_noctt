function createProductsRepository({ statements }) {
  return {
    list() {
      return statements.listProducts.all();
    },
    listAll() {
      return statements.listAllProducts.all();
    },
    getById(id) {
      return statements.getProductById.get(id);
    },
    getByCode(code) {
      return statements.getProductByCode.get(code);
    },
    create(payload) {
      const result = statements.insertProduct.run(payload);
      return statements.getProductById.get(result.lastInsertRowid);
    },
    update(payload) {
      statements.updateProduct.run(payload);
      return statements.getProductById.get(payload.id);
    },
    setActive(id, isActive) {
      statements.setProductActive.run(isActive ? 1 : 0, id);
      return statements.getProductById.get(id);
    },
  };
}

module.exports = { createProductsRepository };
