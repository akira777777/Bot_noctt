import { useEffect, useMemo, useState, useCallback } from "react";
import { apiRequest } from "./api";
import {
  LEAD_STATUS_OPTIONS,
  getLeadStatusLabel,
  normalizeLeadStatus,
} from "./lead-status";

// Simple in-memory cache for API data
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(pattern) {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.startsWith(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

function useTelegramContext() {
  const [context, setContext] = useState({
    ready: false,
    initData: "",
    user: null,
  });

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;

    tg.ready();
    tg.expand();
    setContext({
      ready: true,
      initData: tg.initData || "",
      user: tg.initDataUnsafe?.user || null,
    });
  }, []);

  return context;
}

export default function App() {
  const telegram = useTelegramContext();
  const [activeTab, setActiveTab] = useState("leads");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [leads, setLeads] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [newProduct, setNewProduct] = useState({
    code: "",
    title: "",
    description: "",
    price_text: "",
  });

  const canUseApi = useMemo(
    () => Boolean(telegram.ready && telegram.initData),
    [telegram.ready, telegram.initData],
  );

  async function withLoading(fn) {
    setLoading(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "8930e6",
          },
          body: JSON.stringify({
            sessionId: "8930e6",
            runId: "post-fix",
            hypothesisId: "H12_UI_ERROR_SURFACE",
            location: "webapp/src/App.jsx:93",
            message: "UI surfaced operation error",
            data: {
              errorMessage: err?.message || "unknown",
              activeTab,
              statusFilter,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      setError(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdmin() {
    const cacheKey = "admin";
    const cached = getCachedData(cacheKey);
    if (cached) {
      setAdmin(cached);
      return;
    }
    const data = await apiRequest("/api/admin/me", telegram.initData);
    setAdmin(data.user);
    setCachedData(cacheKey, data.user);
  }

  async function loadLeads() {
    const query =
      statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const cacheKey = `leads${query}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      setLeads(cached);
      return;
    }
    const data = await apiRequest(`/api/leads${query}`, telegram.initData);
    setLeads(data.leads || []);
    setCachedData(cacheKey, data.leads || []);
  }

  async function loadProducts() {
    const cacheKey = "products";
    const cached = getCachedData(cacheKey);
    if (cached) {
      setProducts(cached);
      return;
    }
    const data = await apiRequest("/api/products", telegram.initData);
    setProducts(data.products || []);
    setCachedData(cacheKey, data.products || []);
  }

  async function loadUsers() {
    const cacheKey = "users";
    const cached = getCachedData(cacheKey);
    if (cached) {
      setUsers(cached);
      return;
    }
    const data = await apiRequest("/api/users?limit=50", telegram.initData);
    setUsers(data.users || []);
    setCachedData(cacheKey, data.users || []);
  }

  async function loadStats() {
    const cacheKey = "stats";
    const cached = getCachedData(cacheKey);
    if (cached) {
      setStats(cached);
      return;
    }
    const data = await apiRequest("/api/stats", telegram.initData);
    setStats(data.stats || null);
    setCachedData(cacheKey, data.stats || null);
  }

  async function loadCurrentTabData() {
    if (activeTab === "leads") await loadLeads();
    if (activeTab === "products") await loadProducts();
    if (activeTab === "users") await loadUsers();
    if (activeTab === "stats") await loadStats();
  }

  useEffect(() => {
    if (!canUseApi) return;
    withLoading(async () => {
      await loadAdmin();
      await loadCurrentTabData();
    });
  }, [canUseApi, activeTab, statusFilter]);

  async function updateLeadStatus(leadId, status) {
    const normalizedStatus = normalizeLeadStatus(status);
    if (!normalizedStatus) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7379/ingest/eab98f11-ecc3-47fe-8d2e-29dd361451b3",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "8930e6",
          },
          body: JSON.stringify({
            sessionId: "8930e6",
            runId: "post-fix",
            hypothesisId: "H9_FRONTEND_STATUS_GUARD",
            location: "webapp/src/App.jsx:updateLeadStatus",
            message: "Rejected invalid lead status on client",
            data: {
              leadId,
              rawStatus: status,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      setError("Некорректный статус заявки.");
      return;
    }

    await withLoading(async () => {
      await apiRequest(`/api/leads/${leadId}/status`, telegram.initData, {
        method: "PATCH",
        body: JSON.stringify({ status: normalizedStatus }),
      });
      clearCache("leads");
      await loadLeads();
    });
  }

  async function toggleProduct(productId) {
    await withLoading(async () => {
      await apiRequest(`/api/products/${productId}/toggle`, telegram.initData, {
        method: "POST",
      });
      clearCache("products");
      await loadProducts();
    });
  }

  async function createProduct(event) {
    event.preventDefault();
    await withLoading(async () => {
      await apiRequest("/api/products", telegram.initData, {
        method: "POST",
        body: JSON.stringify(newProduct),
      });
      setNewProduct({ code: "", title: "", description: "", price_text: "" });
      clearCache("products");
      await loadProducts();
    });
  }

  async function setUserBlockState(telegramId, shouldBlock) {
    await withLoading(async () => {
      const endpoint = shouldBlock ? "block" : "unblock";
      await apiRequest(
        `/api/users/${telegramId}/${endpoint}`,
        telegram.initData,
        {
          method: "POST",
        },
      );
      clearCache("users");
      await loadUsers();
    });
  }

  if (!telegram.ready) {
    return (
      <div className="container">
        <h1>Bot Noct Admin</h1>
        <p>Инициализация Telegram Mini App...</p>
      </div>
    );
  }

  if (!canUseApi) {
    return (
      <div className="container">
        <h1>Bot Noct Admin</h1>
        <p>Mini App должен быть открыт из Telegram.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Bot Noct Admin</h1>
        <div className="subtle">
          {admin
            ? `@${admin.username || "admin"} (${admin.telegram_id})`
            : "Загрузка профиля..."}
        </div>
      </header>

      <nav className="tabs">
        {[
          ["leads", "Leads"],
          ["products", "Products"],
          ["users", "Users"],
          ["stats", "Stats"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? "tab active" : "tab"}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="subtle">Обновление данных...</div> : null}

      {activeTab === "leads" ? (
        <section>
          <div className="row">
            <label htmlFor="statusFilter">Фильтр статуса</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => {
                const nextValue =
                  e.target.value === "all"
                    ? "all"
                    : normalizeLeadStatus(e.target.value) || "all";
                setStatusFilter(nextValue);
              }}
            >
              <option value="all">Все статусы</option>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getLeadStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Product</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.id}</td>
                  <td>{lead.client_telegram_id}</td>
                  <td>{lead.product_name}</td>
                  <td>{getLeadStatusLabel(lead.status)}</td>
                  <td>
                    <select
                      value={
                        normalizeLeadStatus(lead.status) ||
                        LEAD_STATUS_OPTIONS[0]
                      }
                      onChange={(e) =>
                        updateLeadStatus(lead.id, e.target.value)
                      }
                    >
                      {LEAD_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {getLeadStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {activeTab === "products" ? (
        <section>
          <form className="card" onSubmit={createProduct}>
            <h2>Новый товар</h2>
            <input
              placeholder="code"
              value={newProduct.code}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, code: e.target.value }))
              }
              required
            />
            <input
              placeholder="title"
              value={newProduct.title}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
            <textarea
              placeholder="description"
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
            <input
              placeholder="price text"
              value={newProduct.price_text}
              onChange={(e) =>
                setNewProduct((prev) => ({
                  ...prev,
                  price_text: e.target.value,
                }))
              }
            />
            <button type="submit">Добавить товар</button>
          </form>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Title</th>
                <th>Price</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.code}</td>
                  <td>{product.title}</td>
                  <td>{product.price_text}</td>
                  <td>{product.is_active ? "yes" : "no"}</td>
                  <td>
                    <button onClick={() => toggleProduct(product.id)}>
                      Toggle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {activeTab === "users" ? (
        <section>
          <table>
            <thead>
              <tr>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Blocked</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.telegram_id}>
                  <td>{user.telegram_id}</td>
                  <td>{user.username || "-"}</td>
                  <td>{user.role}</td>
                  <td>{user.is_blocked ? "yes" : "no"}</td>
                  <td>
                    <button
                      onClick={() =>
                        setUserBlockState(user.telegram_id, !user.is_blocked)
                      }
                    >
                      {user.is_blocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="card">
          <h2>Статистика</h2>
          <p>Всего заявок: {stats?.total || 0}</p>
          <h3>По статусам</h3>
          <ul>
            {(stats?.byStatus || []).map((item) => (
              <li key={item.status}>
                {getLeadStatusLabel(item.status)}: {item.cnt}
              </li>
            ))}
          </ul>
          <h3>Топ товары</h3>
          <ul>
            {(stats?.topProducts || []).map((item) => (
              <li key={item.product_code}>
                {item.product_name} ({item.product_code}): {item.cnt}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
