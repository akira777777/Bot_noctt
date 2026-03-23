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
  const [actionNotice, setActionNotice] = useState("");

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
      const updated = await withLoading(async () => {
        await apiRequest(
          `/api/products/${product.id}/toggle`,
          telegram.initData,
          { method: "POST" },
        );
        clearCache("products");
        await loadProducts();
        return true;
      });
      if (updated) {
        setActionNotice(
          `Товар "${product.title}" ${product.is_active ? "деактивирован" : "активирован"}.`,
        );
      }
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
      const created = await withLoading(async () => {
        await apiRequest("/api/products", telegram.initData, {
          method: "POST",
          body: JSON.stringify(newProduct),
        });
        setNewProduct(EMPTY_PRODUCT);
        clearCache("products");
        await loadProducts();
        return true;
      });
      if (created) {
        setActionNotice(`Товар "${newProduct.title.trim()}" успешно добавлен.`);
      }
      setSubmitting(false);
    },
    [
      telegram.initData,
      newProduct,
      withLoading,
      clearCache,
      loadProducts,
      setError,
    ],
  );

  const updateField = useCallback((field, value) => {
    setNewProduct((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (initialLoad && loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <section>
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      {actionNotice ? (
        <div className="success" role="status">
          {actionNotice}
        </div>
      ) : null}

      <form className="card" onSubmit={createProduct}>
        <h2>Новый товар</h2>
        <div className="inline-help">
          Поля "Код товара" и "Название" обязательны.
        </div>
        <label htmlFor="productCode">Код товара</label>
        <input
          id="productCode"
          placeholder="Код товара"
          value={newProduct.code}
          onChange={(e) => updateField("code", e.target.value)}
          required
          disabled={submitting}
        />
        <label htmlFor="productTitle">Название</label>
        <input
          id="productTitle"
          placeholder="Название"
          value={newProduct.title}
          onChange={(e) => updateField("title", e.target.value)}
          required
          disabled={submitting}
        />
        <label htmlFor="productDescription">Описание</label>
        <textarea
          id="productDescription"
          placeholder="Описание"
          value={newProduct.description}
          onChange={(e) => updateField("description", e.target.value)}
          disabled={submitting}
        />
        <label htmlFor="productPriceText">Текст цены</label>
        <input
          id="productPriceText"
          placeholder="Текст цены"
          value={newProduct.price_text}
          onChange={(e) => updateField("price_text", e.target.value)}
          disabled={submitting}
        />
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Сохранение товара..." : "Добавить товар"}
        </button>
      </form>

      {products.length === 0 && !loading ? (
        <EmptyState message="Товары не найдены" />
      ) : (
        <>
          <div className="table-wrapper desktop-table">
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
                    <td>{product.title}</td>
                    <td>{product.price_text}</td>
                    <td>{product.is_active ? "Да" : "Нет"}</td>
                    <td>
                      <button
                        onClick={() => toggleProduct(product)}
                        disabled={togglingId === product.id}
                      >
                        {togglingId === product.id
                          ? "Обновление..."
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

          <div className="mobile-list">
            {products.map((product) => (
              <article key={product.id} className="mobile-item">
                <div className="mobile-item-row">
                  <span className="mobile-item-label">ID</span>
                  <strong className="mobile-item-value">{product.id}</strong>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Код</span>
                  <span className="mobile-item-value">{product.code}</span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Название</span>
                  <span className="mobile-item-value">{product.title}</span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Цена</span>
                  <span className="mobile-item-value">
                    {product.price_text || "—"}
                  </span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Активен</span>
                  <span className="mobile-item-value">
                    {product.is_active ? "Да" : "Нет"}
                  </span>
                </div>
                <button
                  onClick={() => toggleProduct(product)}
                  disabled={togglingId === product.id}
                >
                  {togglingId === product.id
                    ? "Обновление..."
                    : product.is_active
                      ? "Деактивировать"
                      : "Активировать"}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {loading && !initialLoad ? (
        <div className="subtle loading-inline">
          <span className="dot-spinner" aria-hidden="true" />
          Обновление данных...
        </div>
      ) : null}
    </section>
  );
}
