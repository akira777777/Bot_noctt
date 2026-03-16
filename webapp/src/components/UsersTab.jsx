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
      await withLoading(async () => {
        const endpoint = shouldBlock ? "block" : "unblock";
        await apiRequest(
          `/api/users/${user.telegram_id}/${endpoint}`,
          telegram.initData,
          { method: "POST" },
        );
        clearCache("users");
        await loadUsers();
      });
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

      {users.length === 0 && !loading ? (
        <EmptyState message="Пользователи не найдены" />
      ) : (
        <div className="table-wrapper">
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
                        ? "..."
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
      )}

      {loading && !initialLoad ? (
        <div className="subtle">Обновление данных...</div>
      ) : null}
    </section>
  );
}
