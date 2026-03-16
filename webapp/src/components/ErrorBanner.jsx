import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 8000;

/**
 * Error banner with role="alert" for accessibility and auto-dismiss.
 */
export default function ErrorBanner({ message, onDismiss }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div className="error" role="alert">
      <span>{message}</span>
      <button
        className="error-dismiss"
        onClick={() => { setVisible(false); onDismiss?.(); }}
        aria-label="Закрыть ошибку"
      >
        ✕
      </button>
    </div>
  );
}
