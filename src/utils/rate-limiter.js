/**
 * Sliding-window in-memory rate limiter.
 * Returns a function isAllowed(userId) → boolean.
 *
 * @param {number} maxRequests  Max calls allowed within windowMs
 * @param {number} windowMs     Window length in milliseconds
 */
function createRateLimiter(maxRequests, windowMs) {
  const windows = new Map();

  // Periodically prune idle entries to avoid unbounded Map growth
  const pruneInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [userId, timestamps] of windows) {
      if (timestamps[timestamps.length - 1] <= cutoff) {
        windows.delete(userId);
      }
    }
  }, windowMs).unref();

  function isAllowed(userId) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (windows.get(userId) || []).filter((t) => t > cutoff);
    if (timestamps.length >= maxRequests) {
      windows.set(userId, timestamps);
      return false;
    }
    timestamps.push(now);
    windows.set(userId, timestamps);
    return true;
  }

  function destroy() {
    clearInterval(pruneInterval);
    windows.clear();
  }

  return { isAllowed, destroy };
}

module.exports = { createRateLimiter };
