import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  called_back: "Перезвонили",
  awaiting_payment: "Ожидает оплаты",
  fulfilled: "Выполнена",
  closed: "Закрыта",
};

const STATUS_COLORS = {
  new: "#6366f1",
  in_progress: "#f59e0b",
  called_back: "#3b82f6",
  awaiting_payment: "#8b5cf6",
  fulfilled: "#22c55e",
  closed: "#6b7280",
};

function getInitData() {
  return window.Telegram?.WebApp?.initData || "";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initData = getInitData();
    if (!initData) {
      setError("Откройте приложение через Telegram");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/my-leads`, {
      headers: { Authorization: `tma ${initData}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Ошибка загрузки");
        setOrders(data.leads || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Не удалось загрузить заявки");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="catalog-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="catalog-error">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="catalog-empty">
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div>У вас пока нет заявок</div>
      </div>
    );
  }

  return (
    <div className="orders-list">
      {orders.map((order) => (
        <div key={order.id} className="order-card">
          <div className="order-card-header">
            <span className="order-product-name">{order.product_name}</span>
            <span
              className="order-status-badge"
              style={{ background: STATUS_COLORS[order.status] || "#6b7280" }}
            >
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <div className="order-card-meta">
            <span>Кол-во: {order.quantity}</span>
            {order.comment ? <span className="order-comment">💬 {order.comment}</span> : null}
          </div>
          <div className="order-card-date">{formatDate(order.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
