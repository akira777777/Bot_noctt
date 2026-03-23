import { fetchProducts } from "@/lib/admin-api";
import { ProductTable } from "@/components/admin/product-table";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { products } = await fetchProducts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Товары</h1>
      <ProductTable initialProducts={products} />
    </div>
  );
}
