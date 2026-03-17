const express = require("express");
const { createAdminService } = require("../../services/admin-service");
const {
  LEAD_STATUS_OPTIONS,
  normalizeLeadStatus,
  normalizeLeadRecord,
  normalizeLeadRecords,
} = require("../../domain/lead-status");

function createApiRouter({ repos, isProduction = false }) {
  const router = express.Router();
  const adminService = createAdminService({ repos });

  function requireAdmin(req, res, next) {
    if (!req.auth?.is_admin) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    return next();
  }

  function requireAuth(req, res, next) {
    if (!req.auth?.telegram_id) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    return next();
  }

  // POST /api/leads — any authenticated Telegram user submits an order
  router.post("/leads", requireAuth, (req, res) => {
    const { product_id, quantity, comment, contact_label } = req.body || {};

    const product = repos.products.getById(Number(product_id));
    if (!product || !product.is_active) {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    const qty = Number(quantity);
    if (!qty || qty < 1 || qty > 9999) {
      return res.status(400).json({ ok: false, error: "Quantity must be 1–9999" });
    }

    repos.users.upsert({
      telegram_id: req.auth.telegram_id,
      username: req.auth.username || null,
      first_name: req.auth.first_name || null,
      last_name: null,
      role: "client",
    });

    const lead = repos.leads.create({
      client_telegram_id: req.auth.telegram_id,
      product_code: product.code,
      product_name: product.title,
      quantity: qty,
      comment: comment ? String(comment).slice(0, 500) : "",
      contact_label: contact_label ? String(contact_label).slice(0, 100) : "",
      source_payload: "webapp",
      status: "new",
    });

    return res.status(201).json({ ok: true, lead });
  });

  router.get("/admin/me", requireAdmin, (req, res) => {
    const user = repos.users.getById(req.auth.telegram_id);
    return res.json({
      ok: true,
      user: user || {
        telegram_id: req.auth.telegram_id,
        username: req.auth.username,
        first_name: req.auth.first_name,
      },
    });
  });

  // GET /api/leads/export.csv — must be declared before /leads/:id to avoid param conflict
  router.get("/leads/export.csv", requireAdmin, (_req, res) => {
    const csv = adminService.exportLeadsCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
    return res.send(csv);
  });

  router.get("/leads", requireAdmin, (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
    const offset = (page - 1) * limit;
    const statusFilter = normalizeLeadStatus(req.query.status) || null;

    const total = repos.leads.count(statusFilter);
    const leads = normalizeLeadRecords(
      repos.leads.listPaginated(limit, offset, statusFilter),
    );

    return res.json({
      ok: true,
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  router.get("/leads/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Invalid lead id" });
    }
    const lead = repos.leads.getById(id);
    if (!lead) {
      return res.status(404).json({ ok: false, error: "Lead not found" });
    }
    return res.json({ ok: true, lead: normalizeLeadRecord(lead) });
  });

  router.patch("/leads/:id/status", requireAdmin, (req, res) => {
    const leadId = Number(req.params.id);
    const status = normalizeLeadStatus(req.body?.status);

    if (!leadId || !status) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload",
        details: {
          leadId: req.params.id,
          status: req.body?.status ?? null,
          allowedStatuses: LEAD_STATUS_OPTIONS,
        },
      });
    }

    const existing = repos.leads.getById(leadId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Lead not found" });
    }

    const updated = repos.leads.updateStatus(leadId, status);
    return res.json({ ok: true, lead: normalizeLeadRecord(updated) });
  });

  router.get("/products", requireAdmin, (req, res) => {
    return res.json({ ok: true, products: repos.products.listAll() });
  });

  router.post("/products", requireAdmin, (req, res) => {
    const { code, title, description, price_text, image_url, sort_order } = req.body || {};

    if (!code || !title) {
      return res
        .status(400)
        .json({ ok: false, error: "code and title are required" });
    }

    const result = adminService.addProduct({
      code: String(code).trim(),
      title: String(title).trim(),
      description: description ? String(description) : "",
      price_text: price_text ? String(price_text) : "",
      image_url: image_url ? String(image_url).trim() : null,
      sort_order: Number(sort_order) || 0,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  });

  router.patch("/products/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Invalid product id" });
    }

    const payload = req.body || {};
    const result = adminService.editProduct({
      id,
      title: payload.title,
      description: payload.description,
      price_text: payload.price_text,
      image_url: payload.image_url !== undefined ? (payload.image_url || null) : undefined,
      sort_order:
        payload.sort_order !== undefined
          ? Number(payload.sort_order)
          : undefined,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  router.post("/products/:id/toggle", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: "Invalid product id" });
    }

    const result = adminService.toggleProduct(id);
    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  router.get("/users", requireAdmin, (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
    const offset = (page - 1) * limit;

    const total = repos.users.count();
    const users = repos.users.listPaginated(limit, offset);

    return res.json({
      ok: true,
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  router.post("/users/:id/block", requireAdmin, (req, res) => {
    const telegramId = Number(req.params.id);
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "Invalid telegram id" });
    }

    const result = adminService.blockUser(telegramId);
    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  router.post("/users/:id/unblock", requireAdmin, (req, res) => {
    const telegramId = Number(req.params.id);
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "Invalid telegram id" });
    }

    const result = adminService.unblockUser(telegramId);
    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  });

  router.get("/stats", requireAdmin, (req, res) => {
    const stats = adminService.getStats();
    return res.json({
      ok: true,
      stats: {
        ...stats,
        total_users: repos.users.count(),
        total_products: repos.products.count(),
        active_products: repos.products.countActive(),
      },
    });
  });

  router.use((err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status ?? err.statusCode ?? 500;
    const message = isProduction
      ? "Internal server error"
      : err.message || "Internal server error";
    res.status(status).json({ ok: false, error: message });
  });

  return router;
}

module.exports = {
  createApiRouter,
};
