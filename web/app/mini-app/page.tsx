"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTelegramWebApp } from "@/components/telegram-webapp-provider";

export default function MiniAppPage() {
  const { webApp, user } = useTelegramWebApp();
  const router = useRouter();

  // MainButton: primary CTA to submit a lead
  useEffect(() => {
    if (!webApp) return;

    const go = () => router.push("/form");

    webApp.MainButton.setParams({
      text: "Оставить заявку",
      color: "#2563eb",
      text_color: "#ffffff",
      is_visible: true,
    });
    webApp.MainButton.onClick(go);

    return () => {
      webApp.MainButton.offClick(go);
      webApp.MainButton.hide();
    };
  }, [webApp, router]);

  const greeting = user?.first_name
    ? `Привет, ${user.first_name}!`
    : "Добро пожаловать!";

  return (
    <main id="main-content" className="min-h-screen p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
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
        </div>
      </div>
    </main>
  );
}
