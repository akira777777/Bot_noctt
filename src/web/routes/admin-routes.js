const express = require("express");

function createAdminRoutes({ repos }) {
  const router = express.Router();

  router.get("/me", (req, res) => {
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

  return router;
}

module.exports = { createAdminRoutes };
