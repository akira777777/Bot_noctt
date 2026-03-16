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
    <section>
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {!stats && !loading ? (
        <EmptyState message="Статистика недоступна" />
      ) : stats ? (
        <div className="card">
          <h2>Статистика</h2>
          <p>Всего заявок: {stats.total || 0}</p>

          <h3>По статусам</h3>
          {(stats.byStatus || []).length === 0 ? (
            <p className="subtle">Нет данных</p>
          ) : (
            <ul>
              {stats.byStatus.map((item) => (
                <li key={item.status}>
                  {getLeadStatusLabel(item.status)}: {item.cnt}
                </li>
              ))}
            </ul>
          )}

          <h3>Топ товары</h3>
          {(stats.topProducts || []).length === 0 ? (
            <p className="subtle">Нет данных</p>
          ) : (
            <ul>
              {stats.topProducts.map((item) => (
                <li key={item.product_code}>
                  {item.product_name} ({item.product_code}): {item.cnt}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {loading && !initialLoad ? (
        <div className="subtle">Обновление данных...</div>
      ) : null}
    </section>
  );
}
