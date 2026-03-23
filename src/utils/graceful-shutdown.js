/**
 * Graceful Shutdown Utility
 * Handles SIGTERM/SIGINT signals and gracefully closes all services
 */
const log = require("./logger-enhanced");

// Shutdown state
let isShuttingDown = false;
let shutdownInProgress = false;

/**
 * Create shutdown handler
 */
function createShutdownHandler(services = {}) {
  const { bot, cache, queue, db, server } = services;

  /**
   * Graceful shutdown function
   */
  async function shutdown(signal) {
    if (shutdownInProgress) {
      log.warn("Shutdown already in progress, ignoring signal");
      return;
    }

    shutdownInProgress = true;
    isShuttingDown = true;

    log.info(`Received ${signal}, starting graceful shutdown...`, {
      signal,
      timestamp: new Date().toISOString(),
    });

    const shutdownOrder = [];
    const errors = [];

    // 1. Stop accepting new connections (HTTP server)
    if (server) {
      shutdownOrder.push(
        (async () => {
          try {
            log.info("Closing HTTP server...");
            await new Promise((resolve, reject) => {
              server.close((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            log.info("HTTP server closed");
          } catch (err) {
            log.error("Error closing HTTP server", err);
            errors.push({ component: "server", error: err.message });
          }
        })(),
      );
    }

    // 2. Stop Telegram bot
    if (bot) {
      shutdownOrder.push(
        (async () => {
          try {
            log.info("Stopping Telegram bot...");
            await bot.stop();
            log.info("Telegram bot stopped");
          } catch (err) {
            log.error("Error stopping bot", err);
            errors.push({ component: "bot", error: err.message });
          }
        })(),
      );
    }

    // 3. Close queue service
    if (queue) {
      shutdownOrder.push(
        (async () => {
          try {
            log.info("Closing queue service...");
            await queue.closeQueueService();
            log.info("Queue service closed");
          } catch (err) {
            log.error("Error closing queue service", err);
            errors.push({ component: "queue", error: err.message });
          }
        })(),
      );
    }

    // 4. Close cache service
    if (cache) {
      shutdownOrder.push(
        (async () => {
          try {
            log.info("Closing cache service...");
            await cache.disconnect();
            log.info("Cache service closed");
          } catch (err) {
            log.error("Error closing cache service", err);
            errors.push({ component: "cache", error: err.message });
          }
        })(),
      );
    }

    // 5. Close database
    if (db) {
      shutdownOrder.push(
        (async () => {
          try {
            log.info("Closing database...");
            if (typeof db.close === "function") {
              await db.close();
            }
            log.info("Database closed");
          } catch (err) {
            log.error("Error closing database", err);
            errors.push({ component: "database", error: err.message });
          }
        })(),
      );
    }

    // Wait for all shutdowns with timeout
    const SHUTDOWN_TIMEOUT = 30000; // 30 seconds

    try {
      await Promise.race([
        Promise.all(shutdownOrder),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Shutdown timeout")), SHUTDOWN_TIMEOUT),
        ),
      ]);
    } catch (err) {
      log.error("Shutdown timeout or error", err);
      errors.push({ component: "timeout", error: err.message });
    }

    // Log summary
    if (errors.length > 0) {
      log.error("Shutdown completed with errors", { errors });
    } else {
      log.info("Graceful shutdown completed successfully");
    }

    // Exit process
    process.exit(errors.length > 0 ? 1 : 0);
  }

  /**
   * Register shutdown handlers
   */
  function registerShutdownHandlers() {
    // SIGTERM - Kubernetes sends this when terminating a pod
    process.on("SIGTERM", () => {
      log.info("SIGTERM received");
      shutdown("SIGTERM");
    });

    // SIGINT - Ctrl+C
    process.on("SIGINT", () => {
      log.info("SIGINT received");
      shutdown("SIGINT");
    });

    // Uncaught exceptions
    process.on("uncaughtException", (error) => {
      log.error("Uncaught exception", error, {
        stack: error.stack,
      });
      shutdown("uncaughtException");
    });

    // Unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
      log.error("Unhandled rejection", reason, {
        promise: promise.toString(),
      });
      shutdown("unhandledRejection");
    });

    // BeforeExit - when event loop is empty
    process.on("beforeExit", (code) => {
      log.info("Process beforeExit", { code });
    });

    // Exit
    process.on("exit", (code) => {
      log.info("Process exit", { code });
    });

    log.info("Shutdown handlers registered");
  }

  return {
    registerShutdownHandlers,
    shutdown,
    isShuttingDown: () => isShuttingDown,
  };
}

/**
 * Memory monitoring
 */
function createMemoryMonitor(options = {}) {
  const {
    warnThreshold = 512 * 1024 * 1024, // 512 MB
    criticalThreshold = 768 * 1024 * 1024, // 768 MB
    checkInterval = 30000, // 30 seconds
  } = options;

  let intervalId = null;

  function checkMemory() {
    const mem = process.memoryUsage();
    const heapUsed = mem.heapUsed;

    if (heapUsed > criticalThreshold) {
      log.error("CRITICAL: Memory usage exceeded critical threshold", {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + " MB",
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
        threshold: Math.round(criticalThreshold / 1024 / 1024) + " MB",
      });
    } else if (heapUsed > warnThreshold) {
      log.warn("WARNING: Memory usage exceeded threshold", {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + " MB",
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
        threshold: Math.round(warnThreshold / 1024 / 1024) + " MB",
      });
    }
  }

  function start() {
    if (!intervalId) {
      intervalId = setInterval(checkMemory, checkInterval);
      log.info("Memory monitor started", { checkInterval });
    }
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      log.info("Memory monitor stopped");
    }
  }

  return {
    start,
    stop,
    checkMemory,
  };
}

/**
 * Health check periodic monitor
 */
function createHealthMonitor(options = {}) {
  const {
    checkInterval = 60000, // 1 minute
    services = {},
  } = options;

  let intervalId = null;

  async function performCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check database
    if (services.db) {
      try {
        const start = Date.now();
        await services.db.get("SELECT 1");
        results.checks.database = {
          status: "ok",
          latency: Date.now() - start,
        };
      } catch (err) {
        results.checks.database = {
          status: "error",
          error: err.message,
        };
      }
    }

    // Check cache
    if (services.cache) {
      try {
        const health = await services.cache.healthCheck();
        results.checks.cache = health;
      } catch (err) {
        results.checks.cache = {
          status: "error",
          error: err.message,
        };
      }
    }

    // Check queue
    if (services.queue) {
      try {
        const health = await services.queue.queueHealthCheck();
        results.checks.queue = health;
      } catch (err) {
        results.checks.queue = {
          status: "error",
          error: err.message,
        };
      }
    }

    // Log if any issues
    const hasIssues = Object.values(results.checks).some(
      (c) => c.status !== "ok",
    );
    if (hasIssues) {
      log.warn("Health check found issues", results);
    }

