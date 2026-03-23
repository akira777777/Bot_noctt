const express = require("express");
const {
  LEAD_STATUS_OPTIONS,
  normalizeLeadStatus,
  normalizeLeadRecord,
  normalizeLeadRecords,
} = require("../../domain/lead-status");
const { toPositiveInt } = require("../validators/common");

function createLeadRoutes({ repos }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const statusFilter = normalizeLeadStatus(req.query.status);
    let leads = normalizeLeadRecords(repos.leads.listAll());
    if (req.query.status && statusFilter) {
      leads = leads.filter((lead) => lead.status === statusFilter);
    }
    return res.json({ ok: true, leads });
  });

  router.patch("/:id/status", (req, res) => {
    const leadId = toPositiveInt(req.params.id);
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

  return router;
}

module.exports = { createLeadRoutes };
