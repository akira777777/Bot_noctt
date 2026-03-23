const express = require("express");
const { validateWebLead } = require("../validators/lead");
const { createRateLimiter } = require("../middleware/rate-limit");
const { getLeadStatusLabel } = require("../../domain/lead-status");

function createPublicRoutes({ repos, bot, adminId }) {
  const router = express.Router();

  const leadFormLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: "Слишком много заявок. Повторите через 5 минут.",
  });

  // GET /api/catalog — list active products
  router.get("/catalog", (_req, res) => {
    const products = repos.products.list();
    res.json({ ok: true, products });
  });

  // GET /api/lead/:id/status — public lead status (no PII)
  router.get("/lead/:id/status", (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Invalid lead ID" });
    }

    const lead = repos.leads.getById(id);
    if (!lead) {
      return res.status(404).json({ ok: false, error: "Lead not found" });
    }

    res.json({
      ok: true,
      lead: {
        id: lead.id,
        product_name: lead.product_name,
        quantity: lead.quantity,
        status: lead.status,
        status_label: getLeadStatusLabel(lead.status),
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      },
    });
  });

  // POST /api/lead — create lead from web form
  router.post("/lead", leadFormLimiter, (req, res) => {
    const validation = validateWebLead(req.body);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    const product = repos.products.getByCode(req.body.product_code);
    if (!product || !product.is_active) {
      return res.status(400).json({ ok: false, error: "Product not found or inactive" });
    }

    const lead = repos.leads.create({
      client_telegram_id: 0,
      product_code: product.code,
      product_name: product.title,
      quantity: req.body.quantity,
      comment: (req.body.comment || "").trim().slice(0, 500),
      contact_label: req.body.contact_label.trim().slice(0, 500),
      source_payload: "web_form",
      status: "new",
    });

    // Notify admin via bot (fire-and-forget)
    if (bot && adminId) {
      const text =
        `🌐 Новая заявка с сайта #${lead.id}\n\n` +
        `Товар: ${lead.product_name}\n` +
        `Количество: ${lead.quantity}\n` +
        `Комментарий: ${lead.comment || "—"}\n` +
        `Контакт: ${lead.contact_label}`;

      bot.telegram.sendMessage(adminId, text).catch(() => {});
    }

    res.status(201).json({
      ok: true,
      lead: {
        id: lead.id,
        status: lead.status,
      },
    });
  });

  return router;
}

module.exports = { createPublicRoutes };
