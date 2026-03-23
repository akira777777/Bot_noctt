import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../hooks/useAdminContext";
import { useApi } from "../hooks/useApi";
import { apiRequest } from "../api";
import { confirmAction } from "./ConfirmDialog";
import ErrorBanner from "./ErrorBanner";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

const EMPTY_PRODUCT = { code: "", title: "", description: "", price_text: "" };

export default function ProductsTab() {
  const { telegram } = useAdmin();
  const { loading, error, setError, cachedRequest, withLoading, clearCache } =
    useApi(telegram.initData);

  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);
  const [togglingId, setTogglingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadProducts = useCallback(async () => {
    const data = await cachedRequest("/api/products");
    setProducts(data.products || []);
  }, [cachedRequest]);

  useEffect(() => {
    withLoading(async () => {
      await loadProducts();
      setInitialLoad(false);
    });
  }, [loadProducts, withLoading]);

  const toggleProduct = useCallback(
    async (product) => {
      const action = product.is_active ? "деактивировать" : "активировать";
      const confirmed = await confirmAction(
        `${action.charAt(0).toUpperCase() + action.slice(1)} товар "${product.title}"?`,
      );
      if (!confirmed) return;

      setTogglingId(product.id);
      await withLoading(async () => {
        await apiRequest(
          `/api/products/${product.id}/toggle`,
          telegram.initData,
          { method: "POST" },
        );
        clearCache("products");
        await loadProducts();
      });
      setTogglingId(null);
    },
    [telegram.initData, withLoading, clearCache, loadProducts],
  );

  const createProduct = useCallback(
    async (event) => {
      event.preventDefault();

      // Basic validation
      if (!newProduct.code.trim() || !newProduct.title.trim()) {
        setError("Код и название товара обязательны.");
        return;
      }

      setSubmitting(true);
      await withLoading(async () => {
        await apiRequest("/api/products", telegram.initData, {
          method: "POST",
          body: JSON.stringify(newProduct),
        });
        setNewProduct(EMPTY_PRODUCT);
        clearCache("products");
        await loadProducts();
      });
      setSubmitting(false);
    },
    [telegram.initData, newProduct, withLoading, clearCache, loadProducts, setError],
  );

  const updateField = useCallback((field, value) => {
    setNewProduct((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (initialLoad && loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <section className="section-stack">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <form className="card" onSubmit={createProduct}>
        <h2>Новый товар</h2>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label" htmlFor="product-code">Код товара</label>
            <input
              id="product-code"
              placeholder="Например: bot-noct-1"
              value={newProduct.code}
              onChange={(e) => updateField("code", e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="product-title">Название</label>
            <input
              id="product-title"
              placeholder="Название товара"
              value={newProduct.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="product-description">Описание</label>
            <textarea
              id="product-description"
              placeholder="Краткое описание"
              value={newProduct.description}
              onChange={(e) => updateField("description", e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="product-price-text">Текст цены</label>
            <input
              id="product-price-text"
              placeholder="Например: от 5 000 ₽"
              value={newProduct.price_text}
              onChange={(e) => updateField("price_text", e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Добавление..." : "Добавить товар"}
        </button>
      </form>

      <div className="section-header">
        <div className="subtle">Всего товаров: {products.length}</div>
      </div>

      {products.length === 0 && !loading ? (
        <EmptyState message="Товары не найдены" />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Код</th>
                <th>Название</th>
                <th>Цена</th>
                <th>Активен</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.code}</td>
                  <td className="cell-wrap">{product.title}</td>
                  <td className="cell-wrap">{product.price_text || "—"}</td>
                  <td>
                    <span className={`status-chip ${product.is_active ? "success" : "warning"}`}>
                      {product.is_active ? "Да" : "Нет"}
                    </span>
                  </td>
                  <td>
                    <button
                      className={product.is_active ? "btn-danger" : "btn-primary"}
                      onClick={() => toggleProduct(product)}
                      disabled={togglingId === product.id}
                    >
                      {togglingId === product.id
                        ? "..."
                        : product.is_active
                          ? "Деактивировать"
                          : "Активировать"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && !initialLoad ? (
        <div className="subtle">Обновляем каталог товаров...</div>
      ) : null}
    </section>
  );
}
