/**
 * Skeleton placeholder shown while data is loading.
 * Renders `rows` animated skeleton bars.
 */
export default function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="skeleton-container" aria-busy="true" aria-label="Загрузка данных">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
