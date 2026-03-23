import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../hooks/useAdminContext";
import { useApi } from "../hooks/useApi";
import { getLeadStatusLabel } from "../lead-status";
import ErrorBanner from "./ErrorBanner";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

export default function StatsTab() {
  const { telegram } = useAdmin();
  const { loading, error, setError, cachedRequest, withLoading } =
    useApi(telegram.initData);

  const [stats, setStats] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadStats = useCallback(async () => {
    const data = await cachedRequest("/api/stats");
    setStats(data.stats || null);
  }, [cachedRequest]);

  useEffect(() => {
    withLoading(async () => {
      await loadStats();
      setInitialLoad(false);
    });
  }, [loadStats, withLoading]);

  if (initialLoad && loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <section className="section-stack">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {!stats && !loading ? (
        <EmptyState message="Статистика недоступна" />
      ) : stats ? (
        <>
          <div className="stats-grid">
            <div className="kpi-card">
              <span className="kpi-label">Всего заявок</span>
              <span className="kpi-value">{stats.total || 0}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Товаров в топе</span>
              <span className="kpi-value">{(stats.topProducts || []).length}</span>
            </div>
          </div>

          <div className="card">
            <h3>По статусам</h3>
            <p className="subtle">Распределение заявок по текущим этапам.</p>
            {(stats.byStatus || []).length === 0 ? (
              <p className="subtle">Нет данных</p>
            ) : (
              <ul className="list-compact">
                {stats.byStatus.map((item) => (
                  <li key={item.status} className="list-item">
                    <span>{getLeadStatusLabel(item.status)}</span>
                    <span className="status-chip">{item.cnt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Топ товары</h3>
            <p className="subtle">Наиболее часто выбранные товары в заявках.</p>
            {(stats.topProducts || []).length === 0 ? (
              <p className="subtle">Нет данных</p>
            ) : (
              <ul className="list-compact">
                {stats.topProducts.map((item) => (
                  <li key={item.product_code} className="list-item">
                    <span className="cell-wrap">
                      {item.product_name}{" "}
                      <span className="subtle">({item.product_code})</span>
                    </span>
                    <span className="status-chip">{item.cnt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {loading && !initialLoad ? (
        <div className="subtle">Обновляем статистику...</div>
      ) : null}
    </section>
  );
}
