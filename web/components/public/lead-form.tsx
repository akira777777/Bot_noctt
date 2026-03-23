"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchCatalog, submitWebLead, type Product } from "@/lib/api";

type Step = "product" | "details" | "contact" | "confirm" | "success";
const canTrackLead = process.env.NODE_ENV !== "production";

export function LeadForm({ preselectedProduct }: { preselectedProduct: string }) {
  const [step, setStep] = useState<Step>("product");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [comment, setComment] = useState("");
  const [contactLabel, setContactLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<number | null>(null);

  useEffect(() => {
    fetchCatalog().then(({ products: prods }) => {
      setProducts(prods);
      if (preselectedProduct) {
        const found = prods.find((p) => p.code === preselectedProduct);
        if (found) {
          setSelectedProduct(found);
          setStep("details");
        }
      }
    });
  }, [preselectedProduct]);

  async function handleSubmit() {
    if (!selectedProduct || !contactLabel.trim()) return;

    setLoading(true);
    try {
      const result = await submitWebLead({
        product_code: selectedProduct.code,
        quantity: Number(quantity) || 1,
        comment: comment.trim(),
        contact_label: contactLabel.trim(),
        source: "web_form",
      });
      setCreatedLeadId(result.lead.id);
      setStep("success");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка при отправке заявки");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success" && createdLeadId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-2xl font-bold">Заявка отправлена!</p>
        <p className="text-muted-foreground">Номер заявки: <span className="font-mono">#{createdLeadId}</span></p>
        <p className="text-sm text-muted-foreground">Мы свяжемся с вами в ближайшее время.</p>
        <div className="flex gap-3 justify-center mt-4">
          {canTrackLead && (
            <Link
              href={`/track/${createdLeadId}`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Отследить статус
            </Link>
          )}
          <Link
            href="/catalog"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              canTrackLead
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex gap-2">
        {(["product", "details", "contact", "confirm"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              ["product", "details", "contact", "confirm"].indexOf(step) >= i
                ? "bg-primary"
                : "bg-secondary"
            }`}
          />
        ))}
      </div>

      {step === "product" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Выберите товар:</p>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProduct(p);
                setStep("details");
              }}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-accent/30 transition-colors"
            >
              <p className="font-medium">{p.title}</p>
              {p.price_text && <p className="text-sm text-muted-foreground mt-1">{p.price_text}</p>}
            </button>
          ))}
        </div>
      )}

      {step === "details" && selectedProduct && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Товар: <span className="text-foreground font-medium">{selectedProduct.title}</span>
          </p>
          <div>
            <label className="text-xs text-muted-foreground">Количество</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Комментарий (необязательно)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("product")}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              Назад
            </button>
            <button
              onClick={() => setStep("contact")}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Далее
            </button>
          </div>
        </div>
      )}

      {step === "contact" && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Как с вами связаться?</label>
            <input
              type="text"
              value={contactLabel}
              onChange={(e) => setContactLabel(e.target.value)}
              placeholder="Телефон, email или Telegram username"
              className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("details")}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              Назад
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!contactLabel.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Далее
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && selectedProduct && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Проверьте данные:</p>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Товар</span>
              <span>{selectedProduct.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Количество</span>
              <span className="font-mono">{quantity}</span>
            </div>
            {comment && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Комментарий</span>
                <span className="text-right max-w-[60%]">{comment}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Контакт</span>
              <span>{contactLabel}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("contact")}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
            >
              Назад
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Отправка..." : "Отправить заявку"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
