"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", icon: "~" },
  { href: "/admin/leads", label: "Заявки", icon: "#" },
  { href: "/admin/conversations", label: "Диалоги", icon: ">" },
  { href: "/admin/products", label: "Товары", icon: "*" },
  { href: "/admin/users", label: "Пользователи", icon: "@" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden p-3 rounded-lg hover:bg-accent/50"
        aria-label="Открыть меню навигации"
        aria-expanded={isMobileMenuOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-border bg-card",
          isMobileMenuOpen ? "transform translate-x-0" : "-translate-x-full",
          "lg:static lg:transform-none lg:translate-x-0 transition-transform duration-300"
        )}
        aria-label="Навигация администратора"
      >
        <div className="flex justify-between items-start p-6">
          <div>
            <Link href="/admin" className="text-lg font-bold tracking-tight">
              Bot Noct
            </Link>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-accent/50"
            aria-label="Закрыть меню"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-4">
          <p className="text-xs text-muted-foreground mb-4">Панель управления</p>
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  onClick={() => {
                    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
                  }}
                >
                  <span className="font-mono text-xs w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile menu */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
}
