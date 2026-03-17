import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

function getInitData() {
  return window.Telegram?.WebApp?.initData || "";
}

export default function LeadModal({ product, onClose }) {
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const qty = Number(quantity);
    if (!qty || qty < 1) {
      setError("Укажите количество (минимум 1)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `tma ${getInitData()}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: qty,
          comment: comment.trim(),
          contact_label: contact.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Ошибка при отправке заявки");
        return;
      }

      setDone(true);
    } catch {
      setError("Нет соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <button className="modal-close" onClick={onClose}>✕</button>

        {done ? (
          <div className="modal-success">
            <div className="modal-success-icon">✅</div>
            <h2>Заявка принята!</h2>
            <p>Менеджер свяжется с вами в Telegram.</p>
            <button className="order-btn order-btn-wide" onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <h2 className="modal-title">{product.title}</h2>
            <p className="modal-price">{product.price_text}</p>

            <form onSubmit={handleSubmit} className="modal-form">
              <label className="modal-label">
                Количество
                <input
                  className="modal-input"
                  type="number"
                  min="1"
                  max="9999"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={submitting}
                  required
                />
              </label>

              <label className="modal-label">
                Контакт для связи
                <input
                  className="modal-input"
                  type="text"
                  placeholder="@username, телефон или пусто"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={submitting}
                  maxLength={100}
                />
              </label>

              <label className="modal-label">
                Комментарий (необязательно)
                <textarea
                  className="modal-input modal-textarea"
                  placeholder="Любые пожелания..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  maxLength={500}
                  rows={3}
                />
              </label>

              {error && <div className="modal-error">{error}</div>}

              <button
                type="submit"
                className="order-btn order-btn-wide"
                disabled={submitting}
              >
                {submitting ? "Отправка..." : "Отправить заявку"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
