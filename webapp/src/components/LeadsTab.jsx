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
    <section className="section-stack">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="card">
        <div className="row-wrap">
          <div className="form-field">
            <label className="field-label" htmlFor="statusFilter">
              Фильтр по статусу
            </label>
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
          <div className="subtle">Найдено заявок: {leads.length}</div>
        </div>
      </div>

      {leads.length === 0 && !loading ? (
        <EmptyState message="Заявки не найдены" />
      ) : (
        <div className="table-wrapper">
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
                  <td className="cell-wrap">{lead.product_name}</td>
                  <td>
                    <span className="status-chip">{getLeadStatusLabel(lead.status)}</span>
                  </td>
                  <td>
                    <select
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
      )}

      {loading && !initialLoad ? (
        <div className="subtle">Обновляем список заявок...</div>
      ) : null}
    </section>
  );
}
