const express = require("express");
const { toPositiveInt, parsePagination } = require("../validators/common");

function createUserRoutes({ adminService, repos }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const total = repos.users.count();
    const users = repos.users.list(limit, offset);

    return res.json({
      ok: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  router.post("/:id/block", (req, res) => {
    const telegramId = toPositiveInt(req.params.id);
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "Invalid telegram id" });
    }
    const result = adminService.blockUser(telegramId);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  router.post("/:id/unblock", (req, res) => {
    const telegramId = toPositiveInt(req.params.id);
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: "Invalid telegram id" });
    }
    const result = adminService.unblockUser(telegramId);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  return router;
}

module.exports = { createUserRoutes };
