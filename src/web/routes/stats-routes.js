const express = require("express");

function createStatsRoutes({ adminService }) {
  const router = express.Router();
  router.get("/", (_req, res) =>
    res.json({ ok: true, stats: adminService.getStats() }),
  );
  return router;
}

module.exports = { createStatsRoutes };
