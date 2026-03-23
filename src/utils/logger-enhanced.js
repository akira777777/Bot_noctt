/**
 * Enhanced Logger Module
 * Structured logging with Pino for production-grade observability
 */
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const { NODE_ENV, LOG_LEVEL, LOG_FORMAT } = require("../config/env");

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine if we're in development
const isDevelopment = NODE_ENV !== "production";

// Base transport configuration
const transport = isDevelopment && LOG_FORMAT !== "json"
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        singleLine: false,
      },
    }
  : undefined;

// Create the main logger instance
const logger = pino({
  level: LOG_LEVEL,
  base: {
    service: "telegram-bot",
    env: NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  // Redact sensitive fields from logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "secret",
      "apiKey",
      "*.password",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  // File transport for production
  ...(transport ? { transport } : {}),
});

// Create child loggers for different components
const createComponentLogger = (component) => {
  return logger.child({ component });
};

// Pre-configured component loggers
const loggers = {
  bot: createComponentLogger("bot"),
  api: createComponentLogger("api"),
  db: createComponentLogger("database"),
  cache: createComponentLogger("cache"),
  queue: createComponentLogger("queue"),
  webhook: createComponentLogger("webhook"),
  admin: createComponentLogger("admin"),
  client: createComponentLogger("client"),
};

/**
 * Log message formatting helpers
 */
const formatMessage = (message, meta = {}) => ({
  msg: message,
  ...meta,
});

/**
 * Performance measurement helper
 */
const createTimer = () => {
  const start = process.hrtime.bigint();
  return {
    end: () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1e6; // Convert to milliseconds
    },
  };
};

/**
 * Error serialization for logging
 */
const serializeError = (error) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.code && { code: error.code }),
    };
  }
  return { error: String(error) };
};

/**
 * Structured log functions
 */
const log = {
  // Info level - general operational information
  info: (message, meta = {}) => {
    logger.info(formatMessage(message, meta));
  },

  // Warn level - warning conditions
  warn: (message, meta = {}) => {
    logger.warn(formatMessage(message, meta));
  },

  // Error level - error conditions
  error: (message, error = null, meta = {}) => {
    const errorData = error ? serializeError(error) : {};
    logger.error(formatMessage(message, { ...meta, error: errorData }));
  },

  // Debug level - detailed debugging information
  debug: (message, meta = {}) => {
    logger.debug(formatMessage(message, meta));
  },

  // Fatal level - critical errors that require immediate attention
  fatal: (message, error = null, meta = {}) => {
    const errorData = error ? serializeError(error) : {};
    logger.fatal(formatMessage(message, { ...meta, error: errorData }));
  },

  // HTTP request logging
  http: (method, path, statusCode, responseTime, meta = {}) => {
    logger.info({
      msg: "HTTP Request",
      method,
      path,
      statusCode,
      responseTime,
      ...meta,
    });
  },

  // Bot message logging
  botMessage: (direction, chatId, messageType, meta = {}) => {
    loggers.bot.info({
      msg: `Bot ${direction}`,
      direction, // "incoming" or "outgoing"
      chatId,
      messageType,
      ...meta,
    });
  },

  // Database query logging
  dbQuery: (query, duration, meta = {}) => {
    loggers.db.debug({
      msg: "Database query",
      query: query.substring(0, 200), // Truncate long queries
      duration: `${duration.toFixed(2)}ms`,
      ...meta,
    });
  },

  // Cache operations logging
  cache: (operation, key, hit, meta = {}) => {
    loggers.cache.debug({
      msg: `Cache ${operation}`,
      operation, // "get", "set", "delete"
      key,
      hit,
      ...meta,
    });
  },

  // Queue job logging
  queueJob: (jobName, jobId, status, meta = {}) => {
    loggers.queue.info({
      msg: `Queue job ${status}`,
      jobName,
      jobId,
      status, // "started", "completed", "failed"
      ...meta,
    });
  },

  // Webhook logging
  webhook: (source, event, success, meta = {}) => {
    loggers.webhook.info({
      msg: `Webhook received`,
      source,
      event,
      success,
      ...meta,
    });
  },

  // User action logging
  userAction: (userId, action, meta = {}) => {
    logger.info({
      msg: "User action",
      userId,
      action,
      ...meta,
    });
  },

  // Admin action logging
  adminAction: (adminId, action, targetId, meta = {}) => {
    loggers.admin.info({
      msg: "Admin action",
      adminId,
      action,
      targetId,
      ...meta,
    });
  },

  // Component-specific loggers
  bot: loggers.bot,
  api: loggers.api,
  db: loggers.db,
  cache: loggers.cache,
  queue: loggers.queue,
  webhook: loggers.webhook,
  admin: loggers.admin,
  client: loggers.client,

  // Utility functions
  createComponentLogger,
  createTimer,
  serializeError,
};

module.exports = log;
