/**
 * Lightweight in-process rate limiter (no external deps).
 * Uses a sliding window counter keyed by IP address.
 * Suitable for a single-process deployment.
 */

function createRateLimiter({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests, please try again later.",
  keyGenerator,
} = {}) {
  // Map<key, { count, resetAt }>
  const store = new Map();

  // Evict expired entries every windowMs to prevent memory growth
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs);
  cleanup.unref();

  function resolveKey(req) {
    if (typeof keyGenerator === "function") {
      return keyGenerator(req);
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  return function rateLimitMiddleware(req, res, next) {
    const ip = resolveKey(req);

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(ip, entry);
    } else {
      entry.count += 1;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(entry.resetAt / 1000).toString(),
    );

    if (entry.count > max) {
      return res.status(429).json({ ok: false, error: message });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
