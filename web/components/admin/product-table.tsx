"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/admin-api";

export function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !title.trim() || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim(),
          price_text: priceText.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Ошибка при создании товара" }));
        throw new Error(body.error || "Ошибка при создании товара");
      }
      setCode("");
      setTitle("");
      setDescription("");
      setPriceText("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка при создании товара");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: number) {
    try {
      const response = await fetch(`/api/admin/products/${id}/toggle`, {
        method: "PATCH",
      });
      if (!response.ok) {
        throw new Error("Ошибка при изменении статуса товара");
      }
      router.refresh();
    } catch {
      alert("Ошибка при изменении статуса товара");
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(!showForm)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {showForm ? "Отмена" : "Добавить товар"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Код</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Название</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Цена</label>
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Создание..." : "Создать"}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-6 py-3 font-medium">Код</th>
              <th className="px-6 py-3 font-medium">Название</th>
              <th className="px-6 py-3 font-medium">Цена</th>
              <th className="px-6 py-3 font-medium">Статус</th>
              <th className="px-6 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {initialProducts.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-6 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-6 py-3">{p.title}</td>
                <td className="px-6 py-3 text-muted-foreground">{p.price_text || "—"}</td>
                <td className="px-6 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${
                    p.is_active ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
                  }`}>
                    {p.is_active ? "Активен" : "Скрыт"}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => handleToggle(p.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p.is_active ? "Скрыть" : "Активировать"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
