import Link from "next/link";
import { fetchMessages } from "@/lib/api";
import { ReplyForm } from "@/components/admin/reply-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ConversationDetailPage({ params }: Props) {
  const { clientId } = await params;
  const clientIdNum = Number(clientId);
  const { conversation, client, messages } = await fetchMessages(clientIdNum, 100);

  const clientName = client
    ? client.first_name || client.username || `id:${client.telegram_id}`
    : `Клиент #${clientIdNum}`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl">
      <div className="flex items-center gap-3 pb-4">
        <Link href="/admin/conversations" className="text-muted-foreground hover:text-foreground text-sm">
          ← Диалоги
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-bold tracking-tight">{clientName}</h1>
        {client?.username && (
          <span className="text-xs text-muted-foreground font-mono">@{client.username}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg) => {
          const isAdmin = msg.sender_role === "admin";
          let content = msg.message_text;
          let mediaLabel = "";

          if (msg.message_type !== "text") {
            try {
              const parsed = JSON.parse(msg.message_text);
              content = parsed.caption || "";
              mediaLabel = msg.message_type === "photo" ? "[Фото]" : "[Документ]";
            } catch {
              mediaLabel = msg.message_type === "text" ? "" : `[${msg.message_type}]`;
            }
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                  isAdmin
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {mediaLabel && (
                  <p className="text-xs opacity-70 mb-1">{mediaLabel}</p>
                )}
                {content && <p className="whitespace-pre-wrap">{content}</p>}
                <p className={`text-[10px] mt-1 ${isAdmin ? "opacity-60" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Сообщений нет</p>
        )}
      </div>

      {/* Reply */}
      <ReplyForm clientId={clientIdNum} />
    </div>
  );
}
