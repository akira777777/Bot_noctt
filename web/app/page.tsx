import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight">Bot Noct</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          CRM-система для управления заявками
        </p>
      </div>
      <nav className="flex flex-wrap gap-4 justify-center" aria-label="Основная навигация">
        <Link
          href="/catalog"
          className="rounded-lg bg-secondary px-6 py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-all hover:scale-105 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Перейти в каталог товаров"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Каталог
          </span>
        </Link>
        <Link
          href="/admin"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Перейти в панель управления"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Панель управления
          </span>
        </Link>
      </nav>
    </main>
  );
}
