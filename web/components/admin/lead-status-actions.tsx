"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateLeadStatus } from "@/lib/api";

const STATUSES = [
  { key: "new", label: "Новая" },
  { key: "in_progress", label: "В работе" },
  { key: "called_back", label: "Перезвонили" },
  { key: "awaiting_payment", label: "Ожидает оплаты" },
  { key: "fulfilled", label: "Выполнена" },
  { key: "closed", label: "Закрыта" },
];

interface Props {
  leadId: number;
  currentStatus: string;
}

export function LeadStatusActions({ leadId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(status: string) {
    if (status === currentStatus) return;
    setLoading(true);
    try {
      await updateLeadStatus(leadId, status);
      router.refresh();
    } catch (err) {
      alert("Ошибка при обновлении статуса");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Изменить статус заявки">
      {STATUSES.map((s) => (
        <button
          key={s.key}
          onClick={() => handleStatusChange(s.key)}
          disabled={loading || s.key === currentStatus}
          aria-label={`Установить статус: ${s.label}`}
          aria-pressed={s.key === currentStatus}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
            s.key === currentStatus
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-105"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
