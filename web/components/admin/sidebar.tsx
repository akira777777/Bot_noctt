"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card">
      <div className="p-6">
        <Link href="/admin" className="text-lg font-bold tracking-tight">
          Bot Noct
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Панель управления</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <span className="font-mono text-xs w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <Link
          href="/api/auth/logout"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Выйти
        </Link>
      </div>
    </aside>
  );
}
