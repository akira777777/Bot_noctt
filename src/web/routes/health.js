/**
 * Health Check Routes
 * Comprehensive health monitoring endpoints for container orchestration and load balancers
 */
const express = require("express");
const os = require("os");

const router = express.Router();

// Database check function that will be injected
let dbCheckFn = null;
let cacheCheckService = null;

function setDbCheckFunction(fn) {
  dbCheckFn = fn;
}

function setCacheCheckService(service) {
  cacheCheckService = service;
}

/**
 * Basic health check - for container orchestration
 * Returns 200 if the service is running
 */
router.get("/healthz", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "telegram-bot",
  };

  res.status(200).json(health);
});

/**
 * Readiness probe - checks if service is ready to accept traffic
 * Used by Kubernetes/load balancers to determine if pod should receive traffic
 */
router.get("/readyz", async (req, res) => {
  const checks = {
    database: await performDatabaseCheck(),
    cache: await performCacheCheck(),
    memory: performMemoryCheck(),
  };

  const isReady = Object.values(checks).every(
    (c) => c.status === "ok" || c.status === "degraded",
  );

  const response = {
    ready: isReady,
    timestamp: new Date().toISOString(),
    checks,
  };

  res.status(isReady ? 200 : 503).json(response);
});

/**
 * Liveness probe - checks if service is alive
 * Kubernetes restarts container if this fails
 */
router.get("/livez", async (req, res) => {
  const isAlive = process.uptime() > 0;

  res.status(isAlive ? 200 : 503).json({
    alive: isAlive,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Detailed health check with all system metrics
 */
router.get("/health", async (req, res) => {
  const checks = {
    database: await performDatabaseCheck(),
    cache: await performCacheCheck(),
    memory: performMemoryCheck(),
    cpu: performCPUCheck(),
  };

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");
  const anyDegraded = Object.values(checks).some(
    (c) => c.status === "degraded",
  );

  let status = "healthy";
  if (!allHealthy) status = "unhealthy";
  else if (anyDegraded) status = "degraded";

  const response = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    checks,
    system: {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      usedMemory: os.totalmem() - os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    },
  };

  res.status(status === "unhealthy" ? 503 : 200).json(response);
});

/**
 * Perform database health check
 */
async function performDatabaseCheck() {
  try {
    if (dbCheckFn) {
      return await dbCheckFn();
    }
    return { status: "unknown", message: "DB check not configured" };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

/**
 * Perform cache health check
 */
async function performCacheCheck() {
  try {
    if (!cacheCheckService) {
      return { status: "unknown", message: "Cache check not configured" };
    }

    const cacheHealth = await cacheCheckService.healthCheck();
    const isMemoryFallback = cacheHealth.mode === "memory";

    return {
      status:
        cacheHealth.status === "healthy" || isMemoryFallback
          ? "ok"
          : "degraded",
      mode: cacheHealth.mode,
    };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

/**
 * Perform memory health check
 */
function performMemoryCheck() {
  const used = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  const usedPercent = ((total - free) / total) * 100;
  const processRssMb = Math.round(used.rss / 1024 / 1024);
  const warnThresholdMb = parseInt(process.env.MEMORY_LIMIT_WARN || "512", 10);
  const criticalThresholdMb = parseInt(
    process.env.MEMORY_LIMIT_CRITICAL || "768",
    10,
  );

  let status = "ok";
  if (processRssMb > criticalThresholdMb) status = "critical";
  else if (processRssMb > warnThresholdMb) status = "degraded";

  return {
    status,
    used: {
      rss: Math.round(used.rss / 1024 / 1024), // MB
      heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
      external: Math.round(used.external / 1024 / 1024), // MB
    },
    system: {
      total: Math.round(total / 1024 / 1024), // MB
      free: Math.round(free / 1024 / 1024), // MB
      usedPercent: usedPercent.toFixed(2),
    },
    thresholds: {
      warnRssMb: warnThresholdMb,
      criticalRssMb: criticalThresholdMb,
      currentRssMb: processRssMb,
    },
  };
}

/**
 * Perform CPU health check
 */
function performCPUCheck() {
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;

  // Calculate average load per core
  const avgLoad = loadAvg[0] / cpuCount;

  let status = "ok";
  if (avgLoad > 1.5) status = "critical";
  else if (avgLoad > 0.8) status = "degraded";

  return {
    status,
    loadAverage: {
      "1min": loadAvg[0].toFixed(2),
      "5min": loadAvg[1].toFixed(2),
      "15min": loadAvg[2].toFixed(2),
    },
    cpuCount,
    avgLoadPerCore: avgLoad.toFixed(2),
  };
}

module.exports = {
  router,
  setDbCheckFunction,
  setCacheCheckService,
};
