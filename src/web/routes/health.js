/**
 * Health Check Routes
 * Comprehensive health monitoring endpoints for container orchestration and load balancers
 */
const express = require("express");
const os = require("os");
const {
  APP_VERSION,
  MEMORY_LIMIT_WARN,
  MEMORY_LIMIT_CRITICAL,
} = require("../../config/env");

function createHealthRouter({
  environment = "development",
  dbCheck = null,
  cacheService = null,
  memoryLimitWarn = MEMORY_LIMIT_WARN,
  memoryLimitCritical = MEMORY_LIMIT_CRITICAL,
} = {}) {
  const router = express.Router();

  router.get("/healthz", async (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "telegram-bot",
    });
  });

  router.get("/readyz", async (_req, res) => {
    const checks = {
      database: await performDatabaseCheck(dbCheck),
      cache: await performCacheCheck(cacheService),
      memory: performMemoryCheck(memoryLimitWarn, memoryLimitCritical),
    };

    const isReady = Object.values(checks).every(
      (check) => check.status === "ok" || check.status === "degraded",
    );

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  router.get("/livez", async (_req, res) => {
    const isAlive = process.uptime() > 0;

    res.status(isAlive ? 200 : 503).json({
      alive: isAlive,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/health", async (_req, res) => {
    const checks = {
      database: await performDatabaseCheck(dbCheck),
      cache: await performCacheCheck(cacheService),
      memory: performMemoryCheck(memoryLimitWarn, memoryLimitCritical),
      cpu: performCPUCheck(),
    };

    const allHealthy = Object.values(checks).every(
      (check) => check.status === "ok",
    );
    const anyDegraded = Object.values(checks).some(
      (check) => check.status === "degraded",
    );

    let status = "healthy";
    if (!allHealthy) {
      status = "unhealthy";
    } else if (anyDegraded) {
      status = "degraded";
    }

    res.status(status === "unhealthy" ? 503 : 200).json({
      status,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: process.uptime(),
      environment,
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
    });
  });

  return router;
}

async function performDatabaseCheck(dbCheck) {
  try {
    if (typeof dbCheck === "function") {
      return await dbCheck();
    }

    return { status: "unknown", message: "DB check not configured" };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

async function performCacheCheck(cacheService) {
  try {
    if (!cacheService) {
      return { status: "unknown", message: "Cache check not configured" };
    }

    const cacheHealth = await cacheService.healthCheck();
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

function performMemoryCheck(memoryLimitWarn, memoryLimitCritical) {
  const used = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  const usedPercent = ((total - free) / total) * 100;
  const processRssMb = Math.round(used.rss / 1024 / 1024);

  let status = "ok";
  if (processRssMb > memoryLimitCritical) {
    status = "critical";
  } else if (processRssMb > memoryLimitWarn) {
    status = "degraded";
  }

  return {
    status,
    used: {
      rss: Math.round(used.rss / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
    },
    system: {
      total: Math.round(total / 1024 / 1024),
      free: Math.round(free / 1024 / 1024),
      usedPercent: usedPercent.toFixed(2),
    },
    thresholds: {
      warnRssMb: memoryLimitWarn,
      criticalRssMb: memoryLimitCritical,
      currentRssMb: processRssMb,
    },
  };
}

function performCPUCheck() {
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const avgLoad = loadAvg[0] / cpuCount;

  let status = "ok";
  if (avgLoad > 1.5) {
    status = "critical";
  } else if (avgLoad > 0.8) {
    status = "degraded";
  }

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
  createHealthRouter,
};
