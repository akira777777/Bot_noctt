import { useState, useRef, useCallback } from "react";
import { apiRequest } from "../api";

const CACHE_TTL = 30_000; // 30 seconds

/**
 * Hook that wraps apiRequest with in-memory cache (tied to component lifecycle),
 * loading state, and error handling.
 *
 * @param {string} initData — Telegram initData string for auth
 * @returns {{ loading, error, setError, cachedRequest, mutate, clearCache }}
 */
export function useApi(initData) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheRef = useRef(new Map());

  const clearCache = useCallback((pattern) => {
    const c = cacheRef.current;
    if (pattern) {
      for (const key of c.keys()) {
        if (key.startsWith(pattern)) c.delete(key);
      }
    } else {
      c.clear();
    }
  }, []);

  /**
   * Fetch with cache. Returns cached data if fresh, otherwise fetches.
   * Does NOT set loading/error — caller manages that via `withLoading`.
   */
  const cachedRequest = useCallback(
    async (path, options) => {
      const cacheKey = `${path}${options ? JSON.stringify(options) : ""}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
      }
      const data = await apiRequest(path, initData, options);
      cacheRef.current.set(cacheKey, { data, ts: Date.now() });
      return data;
    },
    [initData],
  );

  /**
   * Execute an async function with loading + error state management.
   */
  const withLoading = useCallback(async (fn) => {
    setLoading(true);
    setError("");
    try {
      return await fn();
    } catch (err) {
      setError(err.message || "Ошибка выполнения операции");
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Shortcut for mutations: sets loading, calls apiRequest (no cache),
   * clears related cache keys, returns result.
   */
  const mutate = useCallback(
    async (path, options, invalidatePattern) => {
      return withLoading(async () => {
        const data = await apiRequest(path, initData, options);
        if (invalidatePattern) clearCache(invalidatePattern);
        return data;
      });
    },
    [initData, withLoading, clearCache],
  );

  return { loading, error, setError, cachedRequest, mutate, clearCache, withLoading };
}
