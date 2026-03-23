import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../hooks/useAdminContext";
import { useApi } from "../hooks/useApi";
import { apiRequest } from "../api";
import { confirmAction } from "./ConfirmDialog";
import ErrorBanner from "./ErrorBanner";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

export default function UsersTab() {
  const { telegram } = useAdmin();
  const { loading, error, setError, cachedRequest, withLoading, clearCache } =
    useApi(telegram.initData);

  const [users, setUsers] = useState([]);
  const [blockingId, setBlockingId] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [actionNotice, setActionNotice] = useState("");

  const loadUsers = useCallback(async () => {
    const data = await cachedRequest("/api/users?limit=50");
    setUsers(data.users || []);
  }, [cachedRequest]);

  useEffect(() => {
    withLoading(async () => {
      await loadUsers();
      setInitialLoad(false);
    });
  }, [loadUsers, withLoading]);

  const setUserBlockState = useCallback(
    async (user, shouldBlock) => {
      const action = shouldBlock ? "заблокировать" : "разблокировать";
      const name = user.username ? `@${user.username}` : user.telegram_id;
      const confirmed = await confirmAction(
        `${action.charAt(0).toUpperCase() + action.slice(1)} пользователя ${name}?`,
      );
      if (!confirmed) return;

      setBlockingId(user.telegram_id);
      const updated = await withLoading(async () => {
        const endpoint = shouldBlock ? "block" : "unblock";
        await apiRequest(
          `/api/users/${user.telegram_id}/${endpoint}`,
          telegram.initData,
          { method: "POST" },
        );
        clearCache("users");
        await loadUsers();
        return true;
      });
      if (updated) {
        setActionNotice(
          `Пользователь ${name} ${shouldBlock ? "заблокирован" : "разблокирован"}.`,
        );
      }
      setBlockingId(null);
    },
    [telegram.initData, withLoading, clearCache, loadUsers],
  );

  if (initialLoad && loading) {
    return <LoadingSkeleton rows={5} />;
  }

  return (
    <section>
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      {actionNotice ? (
        <div className="success" role="status">
          {actionNotice}
        </div>
      ) : null}

      {users.length === 0 && !loading ? (
        <EmptyState message="Пользователи не найдены" />
      ) : (
        <>
          <div className="table-wrapper desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Telegram ID</th>
                  <th>Юзернейм</th>
                  <th>Роль</th>
                  <th>Заблокирован</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.telegram_id}>
                    <td>{user.telegram_id}</td>
                    <td>{user.username || "—"}</td>
                    <td>{user.role}</td>
                    <td>{user.is_blocked ? "Да" : "Нет"}</td>
                    <td>
                      <button
                        onClick={() =>
                          setUserBlockState(user, !user.is_blocked)
                        }
                        disabled={blockingId === user.telegram_id}
                      >
                        {blockingId === user.telegram_id
                          ? "Обновление..."
                          : user.is_blocked
                            ? "Разблокировать"
                            : "Заблокировать"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-list">
            {users.map((user) => (
              <article key={user.telegram_id} className="mobile-item">
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Telegram ID</span>
                  <strong className="mobile-item-value">
                    {user.telegram_id}
                  </strong>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Юзернейм</span>
                  <span className="mobile-item-value">
                    {user.username || "—"}
                  </span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Роль</span>
                  <span className="mobile-item-value">{user.role}</span>
                </div>
                <div className="mobile-item-row">
                  <span className="mobile-item-label">Заблокирован</span>
                  <span className="mobile-item-value">
                    {user.is_blocked ? "Да" : "Нет"}
                  </span>
                </div>
                <button
                  onClick={() => setUserBlockState(user, !user.is_blocked)}
                  disabled={blockingId === user.telegram_id}
                >
                  {blockingId === user.telegram_id
                    ? "Обновление..."
                    : user.is_blocked
                      ? "Разблокировать"
                      : "Заблокировать"}
                </button>
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
