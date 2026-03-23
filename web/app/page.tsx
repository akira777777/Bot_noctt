import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Bot Noct</h1>
      <p className="text-muted-foreground text-lg">CRM-система для управления заявками</p>
      <div className="flex gap-4">
        <Link
          href="/catalog"
          className="rounded-lg bg-secondary px-6 py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Каталог
        </Link>
        <Link
          href="/admin"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Панель управления
        </Link>
      </div>
    </main>
  );
}
