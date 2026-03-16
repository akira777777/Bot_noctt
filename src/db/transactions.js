function createTransactionRunner(db) {
  return function runInTransaction(handler) {
    return db.transaction(handler);
  };
}

module.exports = {
  createTransactionRunner,
};
