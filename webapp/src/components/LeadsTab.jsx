import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../hooks/useAdminContext";
import { useApi } from "../hooks/useApi";
import { apiRequest } from "../api";
import {
  LEAD_STATUS_OPTIONS,
  getLeadStatusLabel,
  normalizeLeadStatus,
} from "../lead-status";
import ErrorBanner from "./ErrorBanner";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

export default function LeadsTab() {
  const { telegram } = useAdmin();
  const { loading, error, setError, cachedRequest, withLoading, clearCache } =
    useApi(telegram.initData);

  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadLeads = useCallback(async () => {
    const query =
      statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const data = await cachedRequest(`/api/leads${query}`);
    setLeads(data.leads || []);
  }, [cachedRequest, statusFilter]);

  useEffect(() => {
    withLoading(async () => {
      await loadLeads();
      setInitialLoad(false);
    });
  }, [loadLeads, withLoading]);

  const updateLeadStatus = useCallback(
    async (leadId, status) => {
      const normalizedStatus = normalizeLeadStatus(status);
      if (!normalizedStatus) {
        setError("Некорректный статус заявки.");
        return;
      }

      setUpdatingId(leadId);
      await withLoading(async () => {
        await apiRequest(`/api/leads/${leadId}/status`, telegram.initData, {
          method: "PATCH",
          body: JSON.stringify({ status: normalizedStatus }),
        });
        clearCache("leads");
        await loadLeads();
      });
      setUpdatingId(null);
    },
    [telegram.initData, withLoading, clearCache, loadLeads, setError],
  );

  if (initialLoad && loading) {
    return <LoadingSkeleton rows={5} />;
  }

  return (
    <section>
      <ErrorBanner message={error} onDismiss={() => setError("")} />

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
      <div className="inline-help">
        Изменение статуса применяется сразу после выбора.
      </div>

      {leads.length === 0 && !loading ? (
        <EmptyState message="Заявки не найдены" />
      ) : (
        <>
          <div className="table-wrapper desktop-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Клиент</th>
                  <th>Товар</th>
                  <th>Статус</th>
                  <th>Действие</th>
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
                        aria-label={`Обновить статус заявки ${lead.id}`}
                        value={
                          normalizeLeadStatus(lead.status) ||
                          LEAD_STATUS_OPTIONS[0]
                        }
                        onChange={(e) =>
                          updateLeadStatus(lead.id, e.target.value)
                        }
                        disabled={updatingId === lead.id}
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
          </div>

          <div className="mobile-list">
            {leads.map((lead) => (
              <article key={lead.id} className="mobile-item">
                <div className="mobile-item-row">
                  <span className="mobile-item-label">ID</span>
                  <strong className="mobile-item-value">{lead.id}</strong>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Клиент</span>
                  <span className="mobile-item-value">{lead.client_telegram_id}</span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Товар</span>
                  <span className="mobile-item-value">{lead.product_name}</span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Статус</span>
                  <span className="mobile-item-value">{getLeadStatusLabel(lead.status)}</span>
                </div>
                <select
                  aria-label={`Обновить статус заявки ${lead.id}`}
                  value={normalizeLeadStatus(lead.status) || LEAD_STATUS_OPTIONS[0]}
                  onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                  disabled={updatingId === lead.id}
                >
                  {LEAD_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {getLeadStatusLabel(status)}
                    </option>
                  ))}
                </select>
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
