"use client";

import Link from "next/link";
import { useEffect } from "react";

type TelegramWebAppWindow = Window & {
  Telegram?: {
    WebApp?: {
      ready?: () => void;
      expand?: () => void;
      setHeaderColor?: (color: string) => void;
      setBackgroundColor?: (color: string) => void;
    };
  };
};

export default function MiniAppPage() {
  useEffect(() => {
    const scriptId = "telegram-webapp-script";

    const initTelegramWebApp = () => {
      const w = window as TelegramWebAppWindow;
      if (!w.Telegram?.WebApp) {
        return;
      }

      w.Telegram.WebApp.ready?.();
      w.Telegram.WebApp.expand?.();
      w.Telegram.WebApp.setHeaderColor?.("#0f172a");
      w.Telegram.WebApp.setBackgroundColor?.("#020617");
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      initTelegramWebApp();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = initTelegramWebApp;
    document.head.appendChild(script);
  }, []);

  return (
    <main id="main-content" className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Bot Noct Mini App</h1>
          <p className="text-sm text-muted-foreground">
            Быстрый доступ к каталогу и заявкам прямо из Telegram.
          </p>
        </div>

        <div className="grid gap-3">
          <Link
            href="/catalog"
            className="rounded-lg bg-secondary px-4 py-3 text-center text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80"
          >
            Открыть каталог
          </Link>
          <Link
            href="/form"
            className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Оставить заявку
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-3 text-center text-sm font-medium transition hover:bg-white/5"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
