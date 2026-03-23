function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function write(level, message, fields = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };

  if (isProduction) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
    return;
  }

  const detail = Object.keys(fields).length ? fields : "";
  // eslint-disable-next-line no-console
  console.log(`[${level.toUpperCase()}] ${message}`, detail);
}

function logInfo(message, extra = {}) {
  write("info", message, extra);
}

function logWarn(message, extra = {}) {
  write("warn", message, extra);
}

function logError(message, error, extra = {}) {
  write("error", message, {
    ...extra,
    error: normalizeError(error),
  });
}

module.exports = {
  logInfo,
  logWarn,
  logError,
};
