const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LEAD_STATUSES,
  LEAD_STATUS_OPTIONS,
  LEAD_STATUS_LABELS,
  normalizeLeadStatus,
  isCanonicalLeadStatus,
} = require("../src/domain/lead-status");

test("canonical lead statuses exclude legacy aliases", () => {
  assert.deepEqual(LEAD_STATUSES, [
    "new",
    "in_progress",
    "called_back",
    "awaiting_payment",
    "fulfilled",
    "closed",
  ]);
  assert.deepEqual(LEAD_STATUS_OPTIONS, LEAD_STATUSES);
  assert.equal(LEAD_STATUSES.includes("open"), false);
});

test("normalizeLeadStatus maps legacy open alias to new", () => {
  assert.equal(normalizeLeadStatus("open"), "new");
  assert.equal(normalizeLeadStatus("new"), "new");
  assert.equal(normalizeLeadStatus("closed"), "closed");
});

test("normalizeLeadStatus rejects unsupported values", () => {
  assert.equal(normalizeLeadStatus("invalid"), null);
  assert.equal(normalizeLeadStatus(""), null);
  assert.equal(normalizeLeadStatus(undefined), null);
  assert.equal(isCanonicalLeadStatus("open"), false);
  assert.equal(isCanonicalLeadStatus("new"), true);
});

test("every canonical lead status has a display label", () => {
  for (const status of LEAD_STATUSES) {
    assert.equal(typeof LEAD_STATUS_LABELS[status], "string");
    assert.ok(LEAD_STATUS_LABELS[status].length > 0);
  }
});
