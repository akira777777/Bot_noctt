function createRateLimiter({ windowMs = 60000, max = 60, message = "Too many requests", keyGenerator } = {}) {
  const hits = new Map();

  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, filtered);
      }
    }
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const key = keyGenerator ? keyGenerator(req) : (req.ip || "unknown");
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((t) => t > cutoff);

    if (timestamps.length >= max) {
      hits.set(key, timestamps);
      return res.status(429).json({ ok: false, error: message });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

module.exports = { createRateLimiter };
