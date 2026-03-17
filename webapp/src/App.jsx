import { useState, useEffect, useMemo } from "react";
import ProductCard from "./components/ProductCard";
import LeadModal from "./components/LeadModal";
import OrderHistory from "./components/OrderHistory";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <div className="app-root">
      {tab === "catalog" ? (
        <>
          <header className="catalog-header">
            <span className="catalog-logo">🛍</span>
            <h1>Каталог</h1>
          </header>

          <div className="search-wrap">
            <input
              className="search-input"
              type="search"
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading && (
            <div className="catalog-loading">
              <div className="spinner" />
            </div>
          )}

          {error && <div className="catalog-error">{error}</div>}

          {!loading && filtered.length === 0 && !error && (
            <div className="catalog-empty">
              {search ? "Ничего не найдено" : "Товары не найдены"}
            </div>
          )}

          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOrder={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <header className="catalog-header">
            <span className="catalog-logo">📋</span>
            <h1>Мои заявки</h1>
          </header>
          <OrderHistory />
        </>
      )}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-btn${tab === "catalog" ? " active" : ""}`}
          onClick={() => setTab("catalog")}
        >
          <span className="bottom-nav-icon">🛒</span>
          <span>Каталог</span>
        </button>
        <button
          className={`bottom-nav-btn${tab === "orders" ? " active" : ""}`}
          onClick={() => setTab("orders")}
        >
          <span className="bottom-nav-icon">📋</span>
          <span>Мои заявки</span>
        </button>
      </nav>

      {selectedProduct && (
        <LeadModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
