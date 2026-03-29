import Link from "next/link";
import { fetchLeadStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUS_STEPS = ["new", "in_progress", "called_back", "proposal_sent", "fulfilled"];
const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  called_back: "Перезвонили",
  proposal_sent: "Предложение отправлено",
  fulfilled: "Выполнена",
  closed: "Закрыта",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TrackLeadPage({ params }: Props) {
  const { id: trackingToken } = await params;

  let lead: {
    tracking_token: string;
    status: string;
    status_label: string;
    product_name: string;
    quantity: number;
    created_at: string;
  } | null = null;
  let error = "";

  try {
    const res = await fetchLeadStatus(trackingToken);
    lead = res.lead;
  } catch {
    error = "Заявка не найдена";
  }

  const currentIndex = lead ? STATUS_STEPS.indexOf(lead.status) : -1;
  const isClosed = lead?.status === "closed";

  return (
    <main className="min-h-screen p-6 lg:p-12 max-w-xl mx-auto">
      <div className="mb-8">
        <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Каталог
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-4">
          Заявка {lead ? <span className="font-mono">{lead.tracking_token}</span> : ""}
        </h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-lg font-bold">Заявка не найдена</p>
          <p className="text-muted-foreground text-sm">Проверьте номер заявки и попробуйте снова</p>
        </div>
      ) : lead ? (
        <div className="space-y-4">
          {/* Status progress */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Текущий статус</p>
              <p className="text-xl font-bold mt-1">{lead.status_label}</p>
            </div>

            {!isClosed && (
              <div className="space-y-2">
                {STATUS_STEPS.map((step, i) => {
                  const isCompleted = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 ${
                          isCurrent
                            ? "bg-primary ring-2 ring-primary/30"
                            : isCompleted
                              ? "bg-primary"
                              : "bg-secondary"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          isCompleted ? "text-foreground" : "text-muted-foreground"
                        } ${isCurrent ? "font-medium" : ""}`}
                      >
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {isClosed && (
              <p className="text-sm text-muted-foreground">Эта заявка была закрыта.</p>
            )}
          </div>

          {/* Lead details */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Позиция</span>
              <span>{lead.product_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Количество</span>
              <span className="font-mono">{lead.quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Дата создания</span>
              <span className="font-mono text-xs">{new Date(lead.created_at).toLocaleString("ru-RU")}</span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
