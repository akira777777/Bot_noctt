/**
 * Database Connection Manager
 * Provides connection health checks, retry logic, and graceful shutdown
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { logError, logInfo, logDebug } = require("../utils/logger");

class DatabaseConnectionManager {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 100,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 30000,
      busyTimeout: options.busyTimeout || 5000,
      ...options,
    };
    this.db = null;
    this.isHealthy = false;
    this.lastError = null;
    this.healthCheckTimer = null;
    this.pendingTransactions = 0;
    this.isShuttingDown = false;
  }

  /**
   * Initialize database connection with retry logic
   */
  async connect() {
    const attempt = async (retryCount = 0) => {
      try {
        logDebug(
          `Connecting to database at ${this.dbPath} (attempt ${retryCount + 1})`,
        );

        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        fs.mkdirSync(dir, { recursive: true });

        // Create connection
        this.db = new Database(this.dbPath);

        // Configure connection
        this.db.pragma("foreign_keys = ON");
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma(`busy_timeout = ${this.options.busyTimeout}`);

        // Verify connection
        this.db.prepare("SELECT 1").get();

        this.isHealthy = true;
        this.lastError = null;

        // Start health checks
        this.startHealthChecks();

        logInfo("Database connected successfully");
        return this.db;
      } catch (error) {
        this.lastError = error;
        this.isHealthy = false;

        if (retryCount < this.options.maxRetries) {
          logError(
            `Database connection failed, retrying in ${this.options.retryDelayMs}ms...`,
            error,
          );
          await this.delay(this.options.retryDelayMs * (retryCount + 1));
          return attempt(retryCount + 1);
        }

        throw new Error(
          `Failed to connect to database after ${this.options.maxRetries} attempts: ${error.message}`,
        );
      }
    };

    return attempt();
  }

  /**
   * Execute database operation with retry logic
   */
  async execute(operation, operationName = "unnamed") {
    if (this.isShuttingDown) {
      throw new Error("Database is shutting down, new operations not allowed");
    }

    const attempt = async (retryCount = 0) => {
      try {
        // Ensure connection is alive
        if (!this.db || !this.isHealthy) {
          await this.reconnect();
        }

        this.pendingTransactions++;
        const result = await operation(this.db);
        this.pendingTransactions--;

        return result;
      } catch (error) {
        this.pendingTransactions = Math.max(0, this.pendingTransactions - 1);

        // Check if error is retryable
        if (
          this.isRetryableError(error) &&
          retryCount < this.options.maxRetries
        ) {
          logError(
            `Database operation '${operationName}' failed, retrying...`,
            error,
          );
          await this.delay(this.options.retryDelayMs * (retryCount + 1));
          return attempt(retryCount + 1);
        }

        throw error;
      }
    };

    return attempt();
  }

  /**
   * Execute operation in transaction with retry logic
   */
  async transaction(handler, operationName = "transaction") {
    return this.execute(async (db) => {
      const tx = db.transaction(handler);
      return tx();
    }, operationName);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [
      "SQLITE_BUSY",
      "SQLITE_LOCKED",
      "SQLITE_PROTOCOL",
      "SQLITE_NOMEM",
    ];

    return retryableCodes.some(
      (code) => error.message?.includes(code) || error.code?.includes(code),
    );
  }

  /**
   * Reconnect to database
   */
  async reconnect() {
    logInfo("Attempting to reconnect to database...");
    this.close();
    return this.connect();
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckIntervalMs);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    try {
      if (!this.db) {
        this.isHealthy = false;
        return;
      }

      this.db.prepare("SELECT 1").get();
      this.isHealthy = true;
      this.lastError = null;
    } catch (error) {
      this.isHealthy = false;
      this.lastError = error;
      logError("Database health check failed", error);
    }
  }

  /**
   * Get connection health status
   */
  getHealth() {
    return {
      isHealthy: this.isHealthy,
      lastError: this.lastError?.message,
      pendingTransactions: this.pendingTransactions,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeoutMs = 30000) {
    logInfo("Initiating database shutdown...");
    this.isShuttingDown = true;

    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Wait for pending transactions with timeout
    const startTime = Date.now();
    while (this.pendingTransactions > 0) {
      if (Date.now() - startTime > timeoutMs) {
        logError(
          `Shutdown timeout reached with ${this.pendingTransactions} pending transactions`,
        );
        break;
      }
      logDebug(
        `Waiting for ${this.pendingTransactions} pending transactions...`,
      );
      await this.delay(100);
    }

    this.close();
    logInfo("Database shutdown complete");
  }

  /**
   * Close connection immediately
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        logError("Error closing database", error);
      }
      this.db = null;
    }
    this.isHealthy = false;
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get raw database instance (use with caution)
   */
  getDatabase() {
    return this.db;
  }
}

module.exports = {
  DatabaseConnectionManager,
};
