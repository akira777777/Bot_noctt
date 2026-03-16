function logInfo(message, extra = {}) {
  // eslint-disable-next-line no-console
  console.log(`[INFO] ${message}`, extra);
}

function logError(message, error) {
  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${message}`, error);
}

module.exports = {
  logInfo,
  logError,
};

