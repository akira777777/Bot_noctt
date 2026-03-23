"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReplyForm({ clientId }: { clientId: number }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/conversations/${clientId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) {
        throw new Error("Не удалось отправить сообщение");
      }
      setText("");
      router.refresh();
    } catch {
      alert("Не удалось отправить сообщение");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-border">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Написать ответ..."
        className="flex-1 rounded-lg bg-input border border-border px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!text.trim() || loading}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "Отправить"}
      </button>
    </form>
  );
}
