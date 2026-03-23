const express = require("express");

function createProductRoutes({ adminService, repos }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    return res.json({ ok: true, products: repos.products.listAll() });
  });

  router.post("/", (req, res) => {
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

  router.patch("/:id", (req, res) => {
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
        payload.sort_order !== undefined ? Number(payload.sort_order) : undefined,
    });
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  router.post("/:id/toggle", (req, res) => {
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

  return router;
}

module.exports = { createProductRoutes };
