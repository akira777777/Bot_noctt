const leadStatusConfig = require("../../shared/lead-statuses.json");

const LEAD_STATUSES = [...leadStatusConfig.canonical];
const LEAD_STATUS_OPTIONS = [...LEAD_STATUSES];
const LEAD_STATUS_ALIASES = { ...(leadStatusConfig.aliases || {}) };
const LEAD_STATUS_LABELS = { ...(leadStatusConfig.labels || {}) };

function normalizeLeadStatus(status) {
  if (typeof status !== "string") {
    return null;
  }

  const trimmedStatus = status.trim();
  if (!trimmedStatus) {
    return null;
  }

  const normalizedStatus = LEAD_STATUS_ALIASES[trimmedStatus] || trimmedStatus;
  return LEAD_STATUSES.includes(normalizedStatus) ? normalizedStatus : null;
}

function isCanonicalLeadStatus(status) {
  return LEAD_STATUSES.includes(status);
}

function normalizeLeadRecord(lead) {
  if (!lead) {
    return lead;
  }

  const normalizedStatus = normalizeLeadStatus(lead.status);
  if (!normalizedStatus || normalizedStatus === lead.status) {
    return lead;
  }

  return {
    ...lead,
    status: normalizedStatus,
  };
}

function normalizeLeadRecords(leads) {
  return leads.map((lead) => normalizeLeadRecord(lead));
}

function getLeadStatusLabel(status) {
  const normalizedStatus = normalizeLeadStatus(status);
  if (!normalizedStatus) {
    return status || "Неизвестный статус";
  }

  return LEAD_STATUS_LABELS[normalizedStatus] || normalizedStatus;
}

module.exports = {
  LEAD_STATUSES,
  LEAD_STATUS_OPTIONS,
  LEAD_STATUS_ALIASES,
  LEAD_STATUS_LABELS,
  normalizeLeadStatus,
  normalizeLeadRecord,
  normalizeLeadRecords,
  isCanonicalLeadStatus,
  getLeadStatusLabel,
};
