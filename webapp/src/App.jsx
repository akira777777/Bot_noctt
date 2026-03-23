import { useEffect, useState } from "react";
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
const TAB_STORAGE_KEY = "bot_noct_admin_active_tab";

function resolveSavedTab() {
  if (typeof window === "undefined") {
    return "leads";
  }
  const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
  return TAB_COMPONENTS[savedTab] ? savedTab : "leads";
}

function AdminPanel() {
  const { telegram, admin, canUseApi, initError, initStatus } = useAdmin();
  const [activeTab, setActiveTab] = useState(resolveSavedTab);

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

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
        <p>
          {initStatus === "missing_telegram"
            ? "Mini App должен быть открыт внутри Telegram."
            : "Не удалось получить данные Telegram сессии. Откройте Mini App заново из бота."}
        </p>
      </div>
    );
  }

  if (initStatus === "forbidden" || initStatus === "unauthorized") {
    return (
      <div className="container">
        <h1>Bot Noct Admin</h1>
        <div className="error" role="alert">
          {initError}
        </div>
        <p className="subtle">
          Вернитесь в чат с ботом и откройте Mini App из аккаунта
          администратора.
        </p>
      </div>
    );
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

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

      {initError ? (
        <div className="error" role="alert">
          {initError}
        </div>
      ) : null}

      <nav className="tabs" aria-label="Разделы админки">
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

      <ActiveTabComponent />
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
