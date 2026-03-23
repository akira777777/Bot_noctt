import Link from "next/link";
import { fetchCatalog } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  let products: Awaited<ReturnType<typeof fetchCatalog>>["products"] = [];
  let fetchError = "";

  try {
    const data = await fetchCatalog();
    products = data.products;
  } catch {
    fetchError =
      "Не удалось загрузить каталог. Проверьте, что API-сервер запущен на API_URL.";
  }

  return (
    <main className="min-h-screen p-6 lg:p-12 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Каталог</h1>
        <p className="text-muted-foreground mt-2">Выберите товар и оставьте заявку</p>
        {fetchError && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-border bg-card p-6 flex flex-col"
          >
            <h3 className="font-semibold text-lg">{product.title}</h3>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-2 flex-1">{product.description}</p>
            )}
            {product.price_text && (
              <p className="text-sm font-medium mt-3">{product.price_text}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Link
                href={`/form?product=${product.code}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Оставить заявку
              </Link>
              <a
                href={`https://t.me/noct1_bot?start=from_channel_${product.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                В Telegram
              </a>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">
            Товаров пока нет
          </p>
        )}
      </div>
    </main>
  );
}
