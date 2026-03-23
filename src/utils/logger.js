function logInfo(message, extra = {}) {
  // eslint-disable-next-line no-console
  if (Object.keys(extra).length) {
    console.log(`[INFO] ${message}`, extra);
  } else {
    console.log(`[INFO] ${message}`);
  }
}

function logError(message, error) {
  // Always log the full stack when available — essential for debugging in production
  const detail =
    error instanceof Error ? error.stack || error.message : error;
  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${message}`, detail);
}

module.exports = {
  logInfo,
  logError,
};
