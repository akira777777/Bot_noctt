/**
 * Error Handling Middleware
 * Centralized error handling with structured logging and proper error responses
 */
const { v4: uuidv4 } = require("uuid");
const log = require("../../utils/logger-enhanced");

// Error codes mapping
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  BOT_ERROR: "BOT_ERROR",
};

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
    this.name = "ValidationError";
  }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Unauthorized error
 */
class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden error
 */
class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(ERROR_CODES.FORBIDDEN, message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends AppError {
  constructor(message = "Too many requests", retryAfter = 60) {
    super(ERROR_CODES.RATE_LIMITED, message, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Error handling middleware
 */
function createErrorHandler({ isProduction = false } = {}) {
  return function errorHandler(err, req, res, next) {
    void next;

    const errorId = uuidv4();
    const statusCode = err.statusCode || err.status || 500;
    const errorCode = err.code || ERROR_CODES.INTERNAL_ERROR;
    const message = err.message || "Internal server error";
    const details = err.details || null;

    const logContext = {
      errorId,
      errorCode,
      statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.telegram_id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      referer: req.get("referer"),
    };

    if (statusCode >= 500) {
      log.error(`Server error: ${message}`, err, logContext);
    } else if (statusCode >= 400) {
      log.warn(`Client error: ${message}`, logContext);
    }

    const errorResponse = {
      success: false,
      error: {
        id: errorId,
        code: errorCode,
        message:
          isProduction && statusCode >= 500
            ? "An internal error occurred"
            : message,
        ...(details && { details }),
      },
    };

    if (err instanceof RateLimitError && err.retryAfter) {
      res.set("Retry-After", err.retryAfter.toString());
    }

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Not found handler - catch 404s
 */
function createNotFoundHandler() {
  return function notFoundHandler(req, res) {
    const errorId = uuidv4();

    log.warn("Route not found", {
      errorId,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(404).json({
      success: false,
      error: {
        id: errorId,
        code: ERROR_CODES.NOT_FOUND,
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  };
}

/**
 * Async handler wrapper - catches async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request logging middleware
 */
function createRequestLogger() {
  return function requestLogger(req, res, next) {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;

      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userId: req.user?.id || req.user?.telegram_id,
      };

      if (res.statusCode >= 400) {
        log.warn("Request completed with error", logData);
      } else {
        log.http(req.method, req.path, res.statusCode, duration, {
          ip: req.ip,
        });
      }
    });

    next();
  };
}

/**
 * Express "trust proxy" setting should be driven by the current app runtime,
 * not by request objects or shared module state.
 */
function trustProxy({ isProduction = false } = {}) {
  return Boolean(isProduction);
}

const errorHandler = createErrorHandler();
const notFoundHandler = createNotFoundHandler();
const requestLogger = createRequestLogger();

module.exports = {
  createErrorHandler,
  createNotFoundHandler,
  createRequestLogger,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestLogger,
  trustProxy,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ERROR_CODES,
};
