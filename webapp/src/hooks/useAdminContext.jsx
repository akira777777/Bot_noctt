import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";

const AdminContext = createContext(null);

function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

/**
 * Provider component: initializes Telegram WebApp, loads admin profile,
 * and exposes context to child components.
 */
export function AdminProvider({ children }) {
  const [telegram, setTelegram] = useState({
    ready: false,
    initData: "",
    user: null,
  });
  const [admin, setAdmin] = useState(null);
  const [initError, setInitError] = useState("");

  // Initialize Telegram WebApp once
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;
    tg.ready();
    tg.expand();
    setTelegram({
      ready: true,
      initData: tg.initData || "",
      user: tg.initDataUnsafe?.user || null,
    });
  }, []);

  const canUseApi = useMemo(
    () => Boolean(telegram.ready && telegram.initData),
    [telegram.ready, telegram.initData],
  );

  // Load admin profile once API is available
  useEffect(() => {
    if (!canUseApi) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/api/admin/me", telegram.initData);
        if (!cancelled) setAdmin(data.user);
      } catch (err) {
        if (!cancelled) setInitError(err.message || "Не удалось загрузить профиль администратора");
      }
    })();
    return () => { cancelled = true; };
  }, [canUseApi, telegram.initData]);

  const value = useMemo(
    () => ({ telegram, admin, canUseApi, initError }),
    [telegram, admin, canUseApi, initError],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/**
 * Hook to access admin context. Must be used inside <AdminProvider>.
 */
export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
