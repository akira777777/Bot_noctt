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
    const { code, title, description, price_text, sort_order } = req.body || {};

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
