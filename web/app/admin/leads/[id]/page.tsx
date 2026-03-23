import Link from "next/link";
import { fetchLead } from "@/lib/api";
import { LeadStatusActions } from "@/components/admin/lead-status-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const { lead, client } = await fetchLead(Number(id));

  const fields = [
    { label: "Товар", value: lead.product_name },
    { label: "Код товара", value: lead.product_code, mono: true },
    { label: "Количество", value: lead.quantity, mono: true },
    { label: "Комментарий", value: lead.comment || "—" },
    { label: "Контакт", value: lead.contact_label },
    { label: "Источник", value: lead.source_payload || "—", mono: true },
    { label: "Создана", value: new Date(lead.created_at).toLocaleString("ru-RU") },
    { label: "Обновлена", value: new Date(lead.updated_at).toLocaleString("ru-RU") },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/leads" className="text-muted-foreground hover:text-foreground text-sm">
          ← Заявки
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold tracking-tight">Заявка #{lead.id}</h1>
      </div>

      {/* Status with actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground mb-2">Текущий статус</p>
        <p className="text-lg font-bold mb-4">{lead.status_label}</p>
        <LeadStatusActions leadId={lead.id} currentStatus={lead.status} />
      </div>

      {/* Lead details */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start justify-between gap-4">
            <span className="text-sm text-muted-foreground shrink-0">{f.label}</span>
            <span className={`text-sm text-right ${f.mono ? "font-mono" : ""}`}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* Client info */}
      {client && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Клиент</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Telegram ID</span>
              <span className="font-mono">{client.telegram_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Имя</span>
              <span>{client.first_name} {client.last_name || ""}</span>
            </div>
            {client.username && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Username</span>
                <span className="font-mono">@{client.username}</span>
              </div>
            )}
            <div className="mt-4">
              <Link
                href={`/admin/conversations/${client.telegram_id}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Открыть диалог →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
