"use client";

import { useRouter } from "next/navigation";
import { toggleUserBlock, type User } from "@/lib/api";

export function UserTable({ users }: { users: User[] }) {
  const router = useRouter();

  async function handleToggleBlock(id: number) {
    try {
      await toggleUserBlock(id);
      router.refresh();
    } catch {
      alert("Ошибка при изменении статуса пользователя");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-6 py-3 font-medium">ID</th>
            <th className="px-6 py-3 font-medium">Имя</th>
            <th className="px-6 py-3 font-medium">Username</th>
            <th className="px-6 py-3 font-medium">Роль</th>
            <th className="px-6 py-3 font-medium">Статус</th>
            <th className="px-6 py-3 font-medium">Регистрация</th>
            <th className="px-6 py-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.telegram_id} className="border-t border-border">
              <td className="px-6 py-3 font-mono text-xs">{user.telegram_id}</td>
              <td className="px-6 py-3">{user.first_name} {user.last_name || ""}</td>
              <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                {user.username ? `@${user.username}` : "—"}
              </td>
              <td className="px-6 py-3 text-xs">{user.role}</td>
              <td className="px-6 py-3">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${
                  user.is_blocked ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                }`}>
                  {user.is_blocked ? "Заблокирован" : "Активен"}
                </span>
              </td>
              <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                {new Date(user.created_at).toLocaleDateString("ru-RU")}
              </td>
              <td className="px-6 py-3">
                <button
                  onClick={() => handleToggleBlock(user.telegram_id)}
                  className={`text-xs transition-colors ${
                    user.is_blocked
                      ? "text-success hover:text-success/80"
                      : "text-destructive hover:text-destructive/80"
                  }`}
                >
                  {user.is_blocked ? "Разблокировать" : "Заблокировать"}
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                Пользователей нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
