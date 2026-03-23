const crypto = require("node:crypto");

const LEAD_TRACKING_TOKEN_BYTES = 12;
const LEAD_TRACKING_TOKEN_LENGTH = LEAD_TRACKING_TOKEN_BYTES * 2;
const LEAD_TRACKING_TOKEN_PATTERN = new RegExp(
  `^[a-f0-9]{${LEAD_TRACKING_TOKEN_LENGTH}}$`,
  "i",
);

function generateLeadTrackingToken() {
  return crypto.randomBytes(LEAD_TRACKING_TOKEN_BYTES).toString("hex");
}

function normalizeLeadTrackingToken(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return LEAD_TRACKING_TOKEN_PATTERN.test(normalized) ? normalized : null;
}

function isLeadTrackingToken(value) {
  return normalizeLeadTrackingToken(value) !== null;
}

module.exports = {
  LEAD_TRACKING_TOKEN_LENGTH,
  generateLeadTrackingToken,
  normalizeLeadTrackingToken,
  isLeadTrackingToken,
};
