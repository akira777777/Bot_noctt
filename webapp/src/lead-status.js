import leadStatusConfig from "../../shared/lead-statuses.json";

export const LEAD_STATUS_OPTIONS = [...leadStatusConfig.canonical];
export const LEAD_STATUS_LABELS = { ...leadStatusConfig.labels };
export const LEAD_STATUS_ALIASES = { ...(leadStatusConfig.aliases || {}) };

export function normalizeLeadStatus(status) {
  if (typeof status !== "string") {
    return null;
  }

  const trimmedStatus = status.trim();
  if (!trimmedStatus) {
    return null;
  }

  const normalizedStatus = LEAD_STATUS_ALIASES[trimmedStatus] || trimmedStatus;
  return LEAD_STATUS_OPTIONS.includes(normalizedStatus) ? normalizedStatus : null;
}

export function getLeadStatusLabel(status) {
  const normalizedStatus = normalizeLeadStatus(status);
  return LEAD_STATUS_LABELS[normalizedStatus] || status;
}
