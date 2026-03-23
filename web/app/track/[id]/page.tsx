import Link from "next/link";
import { fetchLeadStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TrackLeadPage({ params }: Props) {
  const { id } = await params;

  let lead: { id: number; status: string; status_label: string; product_name: string; quantity: number; created_at: string } | null = null;
  let error = "";

  try {
    const res = await fetchLeadStatus(Number(id));
    lead = res.lead;
  } catch {
    error = "Заявка не найдена";
  }

  return (
    <main className="min-h-screen p-6 lg:p-12 max-w-xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← На главную
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-4">Статус заявки</h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : lead ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Номер заявки</span>
            <span className="font-mono font-bold text-lg">#{lead.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Статус</span>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {lead.status_label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Товар</span>
            <span className="text-sm">{lead.product_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Количество</span>
            <span className="font-mono text-sm">{lead.quantity}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Дата создания</span>
            <span className="text-sm text-muted-foreground font-mono">
              {new Date(lead.created_at).toLocaleString("ru-RU")}
            </span>
          </div>
        </div>
      ) : null}
    </main>
  );
}
