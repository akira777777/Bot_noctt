import Link from "next/link";
import { fetchStats, fetchDailyStats, fetchLeads } from "@/lib/admin-api";
import { StatCard } from "@/components/admin/stat-card";
import { DailyChart } from "@/components/admin/daily-chart";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  new: "Новые",
  in_progress: "В работе",
  called_back: "Перезвонили",
  awaiting_payment: "Ожидает оплаты",
  fulfilled: "Выполнены",
  closed: "Закрыты",
};

export default async function AdminDashboard() {
  const [statsRes, dailyRes, recentRes] = await Promise.all([
    fetchStats(),
    fetchDailyStats(30),
    fetchLeads({ limit: 10 }),
  ]);

  const { stats } = statsRes;
  const { daily } = dailyRes;
  const recentLeads = recentRes.leads;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-muted-foreground text-sm mt-1">Обзор заявок и статистика</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Всего заявок" value={stats.total} />
        <StatCard title="Новых сегодня" value={stats.newToday} />
        <StatCard
          title="В работе"
          value={stats.byStatus.in_progress || 0}
        />
        <StatCard
          title="Выполнено"
          value={stats.byStatus.fulfilled || 0}
        />
      </div>

      <DailyChart data={daily} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">По статусам</h3>
          <div className="space-y-3">
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const count = stats.byStatus[key] || 0;
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Популярные товары</h3>
          <div className="space-y-3">
            {stats.topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate mr-4">{p.product_name}</span>
                <span className="font-mono font-medium">{p.count}</span>
              </div>
            ))}
            {stats.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-6 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Последние заявки</h3>
          <Link href="/admin/leads" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Все заявки →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-6 py-3 font-medium">Товар</th>
                <th className="px-6 py-3 font-medium">Клиент</th>
                <th className="px-6 py-3 font-medium">Статус</th>
                <th className="px-6 py-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs">#{lead.id}</td>
                  <td className="px-6 py-3">{lead.product_name}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {lead.first_name || lead.username || `id:${lead.client_telegram_id}`}
                  </td>
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
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    Заявок пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
