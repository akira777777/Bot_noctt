import Link from "next/link";
import { fetchLeads } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "called_back", label: "Перезвонили" },
  { key: "proposal_sent", label: "Предложение отправлено" },
  { key: "fulfilled", label: "Выполнены" },
  { key: "closed", label: "Закрыты" },
];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = params.status || "";
  const page = Math.max(1, Number(params.page) || 1);

  const { leads, pagination } = await fetchLeads({ status: status || undefined, page, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Заявки</h1>
        <a
          href="/api/admin/export/leads"
          className="rounded-lg bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Экспорт CSV
        </a>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/leads${tab.key ? `?status=${tab.key}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              status === tab.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Leads table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Товар</th>
              <th className="px-6 py-3 font-medium">Кол-во</th>
              <th className="px-6 py-3 font-medium">Клиент</th>
              <th className="px-6 py-3 font-medium">Контакт</th>
              <th className="px-6 py-3 font-medium">Статус</th>
              <th className="px-6 py-3 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                <td className="px-6 py-3">
                  <Link href={`/admin/leads/${lead.id}`} className="font-mono text-xs hover:underline">
                    #{lead.id}
                  </Link>
                </td>
                <td className="px-6 py-3">{lead.product_name}</td>
                <td className="px-6 py-3 font-mono">{lead.quantity}</td>
                <td className="px-6 py-3 text-muted-foreground">
                  {lead.first_name || lead.username || `id:${lead.client_telegram_id}`}
                </td>
                <td className="px-6 py-3 text-muted-foreground text-xs">{lead.contact_label}</td>
                <td className="px-6 py-3">
                  <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                    {lead.status_label}
                  </span>
                </td>
                <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                  {new Date(lead.created_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  Заявок не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/leads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                p === page ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
