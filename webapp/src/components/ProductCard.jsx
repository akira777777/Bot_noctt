// Deterministic gradient from product code — no image needed as fallback
function gradientFor(code = "") {
  const hash = [...code].reduce(
    (h, c) => ((h * 31 + c.charCodeAt(0)) & 0xffff),
    0,
  );
  const h1 = hash % 360;
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1},55%,48%), hsl(${h2},65%,36%))`;
}

export default function ProductCard({ product, onOrder }) {
  return (
    <div className="product-card">
      <div className="product-image-wrap">
        {product.image_url ? (
          <img
            className="product-image"
            src={product.image_url}
            alt={product.title}
            loading="lazy"
          />
        ) : (
          <div
            className="product-image-placeholder"
            style={{ background: gradientFor(product.code) }}
          >
            <span className="product-image-icon">📦</span>
          </div>
        )}
      </div>

      <div className="product-body">
        <div className="product-title">{product.title}</div>
        {product.description ? (
          <div className="product-desc">{product.description}</div>
        ) : null}
        <div className="product-footer">
          <div className="product-prices">
            {product.price_per_unit ? (
              <span className="product-unit-price">
                {product.price_per_unit.toLocaleString("ru-RU")} ₽/шт.
              </span>
            ) : (
              <span className="product-price">{product.price_text || "—"}</span>
            )}
          </div>
          <button className="order-btn" onClick={onOrder}>
            Заказать
          </button>
        </div>
      </div>
    </div>
  );
}
