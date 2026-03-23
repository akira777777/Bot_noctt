import Link from "next/link";
import { fetchConversations } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const { conversations } = await fetchConversations(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Диалоги</h1>

      <div className="space-y-2">
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/admin/conversations/${conv.client_telegram_id}`}
            className="block rounded-xl border border-border bg-card p-4 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  Клиент #{conv.client_telegram_id}
                </span>
                {conv.source_payload && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {conv.source_payload}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(conv.updated_at).toLocaleString("ru-RU")}
              </span>
            </div>
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Диалогов пока нет</p>
        )}
      </div>
    </div>
  );
}
