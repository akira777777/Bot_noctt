/**
 * Redis Cache Service
 * High-performance caching layer with TTL management and cache invalidation
 */
const Redis = require("ioredis");
const log = require("../utils/logger-enhanced");

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  SESSION: parseInt(process.env.REDIS_TTL_SESSION || "3600", 10), // 1 hour
  CATALOG: parseInt(process.env.REDIS_TTL_CATALOG || "300", 10), // 5 minutes
  PRODUCT: parseInt(process.env.REDIS_TTL_PRODUCT || "600", 10), // 10 minutes
  STATS: parseInt(process.env.REDIS_TTL_STATS || "60", 10), // 1 minute
  USER: parseInt(process.env.REDIS_TTL_USER || "1800", 10), // 30 minutes
  LEAD: parseInt(process.env.REDIS_TTL_LEAD || "300", 10), // 5 minutes
  CONVERSATION: parseInt(process.env.REDIS_TTL_CONVERSATION || "900", 10), // 15 minutes
};

// Cache key prefixes for namespacing
const CACHE_KEYS = {
  SESSION: "session:",
  CATALOG: "catalog:",
  PRODUCT: "product:",
  STATS: "stats:",
  USER: "user:",
  LEAD: "lead:",
  CONVERSATION: "conversation:",
  RATE_LIMIT: "ratelimit:",
};

class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.isConnected = false;
    this.fallbackToMemory = !redisClient;

    // In-memory fallback when Redis is not available
    this.memoryCache = new Map();
    this.memoryCacheExpiry = new Map();
  }

  /**
   * Connect to Redis with retry logic
   */
  async connect() {
    if (this.fallbackToMemory) {
      log.warn("Redis not configured, using in-memory cache fallback");
      return;
    }

    try {
      await this.redis.ping();
      this.isConnected = true;
      log.info("Redis cache connected successfully");
    } catch (error) {
      log.error(
        "Failed to connect to Redis, falling back to in-memory cache",
        error,
      );
      this.fallbackToMemory = true;
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    const timer = log.createTimer();

    try {
      if (this.fallbackToMemory) {
        return this.memoryGet(key);
      }

      const value = await this.redis.get(key);

      if (value === null) {
        log.cache("get", key, false, { duration: timer.end() });
        return null;
      }

      log.cache("get", key, true, { duration: timer.end() });
      return JSON.parse(value);
    } catch (error) {
      log.error(`Cache get error for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key, value, ttlSeconds = null) {
    const timer = log.createTimer();

    try {
      if (this.fallbackToMemory) {
        return this.memorySet(key, value, ttlSeconds);
      }

      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds || CACHE_TTL.SESSION;

      await this.redis.setex(key, ttl, serialized);

      log.cache("set", key, true, {
        duration: timer.end(),
        ttl,
      });
      return true;
    } catch (error) {
      log.error(`Cache set error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete specific key from cache
   */
  async del(key) {
    try {
      if (this.fallbackToMemory) {
        this.memoryDelete(key);
        return true;
      }

      await this.redis.del(key);
      log.cache("delete", key, true);
      return true;
    } catch (error) {
      log.error(`Cache delete error for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete keys by pattern (use carefully in production)
   */
  async delByPattern(pattern) {
    try {
      if (this.fallbackToMemory) {
        for (const key of this.memoryCache.keys()) {
          if (key.includes(pattern.replace("*", ""))) {
            this.memoryDelete(key);
          }
        }
        return true;
      }

      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        log.cache("deletepattern", pattern, true, { count: keys.length });
      }
      return true;
    } catch (error) {
      log.error(`Cache delete by pattern error: ${pattern}`, error);
      return false;
    }
  }

  /**
   * Cache session data
   */
  async setSession(sessionId, data) {
    return this.set(
      `${CACHE_KEYS.SESSION}${sessionId}`,
      data,
      CACHE_TTL.SESSION,
    );
  }

  async getSession(sessionId) {
    return this.get(`${CACHE_KEYS.SESSION}${sessionId}`);
  }

  async deleteSession(sessionId) {
    return this.del(`${CACHE_KEYS.SESSION}${sessionId}`);
  }

  /**
   * Cache catalog products
   */
  async setCatalog(products) {
    return this.set(`${CACHE_KEYS.CATALOG}all`, products, CACHE_TTL.CATALOG);
  }

  async getCatalog() {
    return this.get(`${CACHE_KEYS.CATALOG}all`);
  }

  async invalidateCatalog() {
    return this.del(`${CACHE_KEYS.CATALOG}all`);
  }

  /**
   * Cache individual product
   */
  async setProduct(productId, product) {
    return this.set(
      `${CACHE_KEYS.PRODUCT}${productId}`,
      product,
      CACHE_TTL.PRODUCT,
    );
  }

  async getProduct(productId) {
    return this.get(`${CACHE_KEYS.PRODUCT}${productId}`);
  }

  async invalidateProduct(productId) {
    return this.del(`${CACHE_KEYS.PRODUCT}${productId}`);
  }

  /**
   * Cache statistics
   */
  async setStats(stats) {
    return this.set(`${CACHE_KEYS.STATS}dashboard`, stats, CACHE_TTL.STATS);
  }

  async getStats() {
    return this.get(`${CACHE_KEYS.STATS}dashboard`);
  }

  async invalidateStats() {
    return this.del(`${CACHE_KEYS.STATS}dashboard`);
  }

  /**
   * Cache user data
   */
  async setUser(userId, userData) {
    return this.set(`${CACHE_KEYS.USER}${userId}`, userData, CACHE_TTL.USER);
  }

  async getUser(userId) {
    return this.get(`${CACHE_KEYS.USER}${userId}`);
  }

  async deleteUser(userId) {
    return this.del(`${CACHE_KEYS.USER}${userId}`);
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(key, limit, windowSeconds) {
    const fullKey = `${CACHE_KEYS.RATE_LIMIT}${key}`;
    const timer = log.createTimer();

    try {
      if (this.fallbackToMemory) {
        return this.memoryRateLimit(fullKey, limit, windowSeconds);
      }

      const current = await this.redis.incr(fullKey);

      if (current === 1) {
        // First request, set expiry
        await this.redis.expire(fullKey, windowSeconds);
      }

      const ttl = await this.redis.ttl(fullKey);
      const remaining = Math.max(0, limit - current);
      const resetIn = ttl > 0 ? ttl : windowSeconds;

      log.cache("ratelimit", key, true, {
        current,
        limit,
        remaining,
        resetIn,
        duration: timer.end(),
      });

      return {
        allowed: current <= limit,
        remaining,
        resetIn,
        limit,
      };
    } catch (error) {
      log.error(`Rate limit check error for key: ${key}`, error);
      // Fail open - allow request if cache fails
      return {
        allowed: true,
        remaining: limit,
        resetIn: windowSeconds,
        limit,
      };
    }
  }

  /**
   * Invalidate all caches (useful for full cache flush)
   */
  async invalidateAll() {
    await this.delByPattern("catalog:*");
    await this.delByPattern("product:*");
    await this.delByPattern("stats:*");
    log.info("All caches invalidated");
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (this.fallbackToMemory) {
      return {
        isConnected: false,
        fallback: true,
        memoryKeys: this.memoryCache.size,
      };
    }

    try {
      const info = await this.redis.info("memory");
      const keys = await this.redis.dbsize();

      return {
        isConnected: this.isConnected,
        fallback: false,
        keys,
        memoryInfo: info,
      };
    } catch (error) {
      return {
        isConnected: false,
        fallback: true,
        error: error.message,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (this.fallbackToMemory) {
        return { status: "degraded", mode: "memory" };
      }

      await this.redis.ping();
      return { status: "healthy", mode: "redis" };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (!this.fallbackToMemory && this.redis) {
      await this.redis.quit();
      log.info("Redis connection closed");
    }
    this.isConnected = false;
  }

  // ============ In-Memory Fallback Methods ============

  memoryGet(key) {
    const expiry = this.memoryCacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.memoryDelete(key);
      return null;
    }
    return this.memoryCache.get(key) || null;
  }

  memorySet(key, value, ttlSeconds) {
    this.memoryCache.set(key, value);
    if (ttlSeconds) {
      this.memoryCacheExpiry.set(key, Date.now() + ttlSeconds * 1000);
    }
    return true;
  }

  memoryDelete(key) {
    this.memoryCache.delete(key);
    this.memoryCacheExpiry.delete(key);
    return true;
  }

  memoryRateLimit(key, limit, windowSeconds) {
    const current = (this.memoryCache.get(key) || 0) + 1;
    this.memoryCache.set(key, current);
    this.memoryCacheExpiry.set(key, Date.now() + windowSeconds * 1000);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: windowSeconds,
      limit,
    };
  }
}

/**
 * Create Redis client with configuration
 */
function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    log.warn("REDIS_URL not configured, using in-memory cache fallback");
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        log.error(`Redis connection failed after ${times} attempts`);
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Exponential backoff
    },
    reconnectOnError: (err) => {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true; // Reconnect on read-only errors
      }
      return false;
    },
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("connect", () => {
    log.info("Redis client connecting");
  });

  client.on("ready", () => {
    log.info("Redis client ready");
  });

  client.on("error", (error) => {
    log.error("Redis client error", error);
  });

  client.on("close", () => {
    log.warn("Redis connection closed");
  });

  return client;
}

// Singleton cache service instance
let cacheService = null;

/**
 * Get or create cache service instance
 */
function getCacheService() {
  if (!cacheService) {
    const redisClient = createRedisClient();
    cacheService = new CacheService(redisClient);
  }
  return cacheService;
}

module.exports = {
  CacheService,
  getCacheService,
  createRedisClient,
  CACHE_TTL,
  CACHE_KEYS,
};
