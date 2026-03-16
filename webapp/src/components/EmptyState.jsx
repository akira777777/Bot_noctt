/**
 * Displays a "no data" message when a list/table is empty.
 */
export default function EmptyState({ message = "Нет данных" }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}
