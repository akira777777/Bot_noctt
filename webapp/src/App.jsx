import { useState } from "react";
import { AdminProvider, useAdmin } from "./hooks/useAdminContext";
import LeadsTab from "./components/LeadsTab";
import ProductsTab from "./components/ProductsTab";
import UsersTab from "./components/UsersTab";
import StatsTab from "./components/StatsTab";

const TABS = [
  ["leads", "Заявки"],
  ["products", "Товары"],
  ["users", "Пользователи"],
  ["stats", "Статистика"],
];

const TAB_COMPONENTS = {
  leads: LeadsTab,
  products: ProductsTab,
  users: UsersTab,
  stats: StatsTab,
};

function AdminPanel() {
  const { telegram, admin, canUseApi, initError } = useAdmin();
  const [activeTab, setActiveTab] = useState(null);
  const activeTabLabel = TABS.find(([id]) => id === activeTab)?.[1];

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

  const ActiveTabComponent = activeTab ? TAB_COMPONENTS[activeTab] : null;

  return (
    <div className="container">
      <header className="header panel">
        <div className="header-title">
          <h1>Bot Noct Admin</h1>
          <p className="subtle">
            Управление заявками, товарами, пользователями и аналитикой.
          </p>
        </div>
        <div className="subtle">
          {admin ? (
            <>
              <strong>@{admin.username || "admin"}</strong>
              <br />
              ID: {admin.telegram_id}
            </>
          ) : (
            "Загрузка профиля..."
          )}
        </div>
      </header>

      {initError ? <div className="error" role="alert">{initError}</div> : null}

      {activeTab === null ? (
        <div className="menu-grid">
          {TABS.map(([id, label]) => (
            <button key={id} className="menu-card" onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <nav className="tabs">
            <button className="tab-back" onClick={() => setActiveTab(null)}>
              ← К разделам
            </button>
            {TABS.map(([id, label]) => (
              <button
                key={id}
                className={activeTab === id ? "tab active" : "tab"}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="section-header">
            <h2>{activeTabLabel}</h2>
            <span className="subtle">Операционный раздел</span>
          </div>
          <ActiveTabComponent />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <AdminPanel />
    </AdminProvider>
  );
}
