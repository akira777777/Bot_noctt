const isProduction = process.env.NODE_ENV === "production";

function logInfo(message, extra = {}) {
  // eslint-disable-next-line no-console
  console.log(`[INFO] ${message}`, Object.keys(extra).length ? extra : "");
}

function logError(message, error) {
  const detail = isProduction && error instanceof Error ? error.message : error;
  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${message}`, detail);
}

module.exports = {
  logInfo,
  logError,
};
