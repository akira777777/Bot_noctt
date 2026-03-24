"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTelegramWebApp } from "@/components/telegram-webapp-provider";
import { fetchCatalog, type Product } from "@/lib/api";

export default function MiniAppPage() {
  const { webApp, user } = useTelegramWebApp();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [trackToken, setTrackToken] = useState("");

  // Load catalog
  useEffect(() => {
    fetchCatalog()
      .then(({ products: p }) => setProducts(p.filter((x) => x.is_active)))
      .catch(() => {});
  }, []);

  // MainButton: go to full catalog
  useEffect(() => {
    if (!webApp) return;

    const go = () => router.push("/catalog");

    webApp.MainButton.setParams({
      text: "Все товары",
      color: "#1e293b",
      text_color: "#ffffff",
      is_visible: true,
    });
    webApp.MainButton.onClick(go);

    return () => {
      webApp.MainButton.offClick(go);
      webApp.MainButton.hide();
    };
  }, [webApp, router]);

  const greeting = user?.first_name ? `Привет, ${user.first_name}!` : "Добро пожаловать!";

  return (
    <main id="main-content" className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">Выберите товар и оставьте заявку</p>
      </div>

      {/* Product cards */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Каталог
        </h2>
        {products.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Загрузка…
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight truncate">{p.title}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                  {p.price_text && (
                    <p className="text-sm font-semibold mt-2">{p.price_text}</p>
                  )}
                </div>
                <Link
                  href={`/form?product=${p.code}`}
                  className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  Заявку
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Order tracking */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Статус заявки
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Введите номер заявки для проверки статуса</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackToken}
              onChange={(e) => setTrackToken(e.target.value.trim())}
              placeholder="Например: abc123"
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            <button
              onClick={() => trackToken && router.push(`/track/${trackToken}`)}
              disabled={!trackToken}
              className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-40 transition-colors hover:bg-secondary/80"
            >
              Найти
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
