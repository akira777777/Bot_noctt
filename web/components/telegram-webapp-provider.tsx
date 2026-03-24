"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setParams: (params: { text?: string; color?: string; text_color?: string; is_visible?: boolean }) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  initData: string;
  colorScheme: "light" | "dark";
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
}

interface TelegramWebAppContext {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  isTelegram: boolean;
}

const TgContext = createContext<TelegramWebAppContext>({
  webApp: null,
  user: null,
  isTelegram: false,
});

export function useTelegramWebApp() {
  return useContext(TgContext);
}

const SCRIPT_ID = "telegram-webapp-script";
const SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

export function TelegramWebAppProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<TelegramWebAppContext>({
    webApp: null,
    user: null,
    isTelegram: false,
  });

  const pathname = usePathname();
  const router = useRouter();

  // Load SDK and initialize
  useEffect(() => {
    function init() {
      const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
      const wa = w.Telegram?.WebApp;
      if (!wa) return;

      wa.ready();
      wa.expand();
      wa.setHeaderColor("#0f172a");
      wa.setBackgroundColor("#020617");

      setCtx({
        webApp: wa,
        user: wa.initDataUnsafe?.user ?? null,
        isTelegram: true,
      });
    }

    // Already loaded (e.g. Telegram injects it before page load)
    if ((window as unknown as { Telegram?: unknown }).Telegram) {
      init();
      return;
    }

    // Check if script tag already exists
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", init);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, []);

  // Back button: show on sub-pages, hide on /mini-app root
  useEffect(() => {
    const wa = ctx.webApp;
    if (!wa) return;

    const isRoot = pathname === "/mini-app" || pathname === "/";

    if (isRoot) {
      wa.BackButton.hide();
    } else {
      wa.BackButton.show();
    }

    const handleBack = () => {
      router.back();
    };

    wa.BackButton.onClick(handleBack);
    return () => {
      wa.BackButton.offClick(handleBack);
    };
  }, [ctx.webApp, pathname, router]);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
