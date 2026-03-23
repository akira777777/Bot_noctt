const express = require("express");
const { createAdminService } = require("../../services/admin-service");
const { requireAdmin } = require("../middleware/require-admin");
const { createAdminRoutes } = require("./admin-routes");
const { createLeadRoutes } = require("./lead-routes");
const { createProductRoutes } = require("./product-routes");
const { createUserRoutes } = require("./user-routes");
const { createStatsRoutes } = require("./stats-routes");

function createApiRouter({ repos }) {
  const router = express.Router();
  const adminService = createAdminService({ repos });

  router.use(requireAdmin);
  router.use("/admin", createAdminRoutes({ repos }));
  router.use("/leads", createLeadRoutes({ repos }));
  router.use("/products", createProductRoutes({ adminService, repos }));
  router.use("/users", createUserRoutes({ adminService, repos }));
  router.use("/stats", createStatsRoutes({ adminService }));

  return router;
}

module.exports = { createApiRouter };
