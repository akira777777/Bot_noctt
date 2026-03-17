import { useState, useEffect } from "react";
import ProductCard from "./components/ProductCard";
import LeadModal from "./components/LeadModal";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    fetch(`${API_BASE}/api/catalog`)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось загрузить каталог");
        setLoading(false);
      });
  }, []);

  return (
    <div className="catalog-root">
      <header className="catalog-header">
        <span className="catalog-logo">🛍</span>
        <h1>Каталог</h1>
      </header>

      {loading && (
        <div className="catalog-loading">
          <div className="spinner" />
        </div>
      )}

      {error && <div className="catalog-error">{error}</div>}

      {!loading && products.length === 0 && !error && (
        <div className="catalog-empty">Товары не найдены</div>
      )}

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onOrder={() => setSelectedProduct(product)}
          />
        ))}
      </div>

      {selectedProduct && (
        <LeadModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
