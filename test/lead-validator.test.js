const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWebLead } = require("../src/web/validators/lead");

// ── product_code ──────────────────────────────────────────────────────────────

test("validateWebLead rejects missing product_code", () => {
  const { ok, errors } = validateWebLead({ quantity: 1, contact_label: "t" });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("product_code")));
});

test("validateWebLead rejects null product_code", () => {
  const { ok } = validateWebLead({ product_code: null, quantity: 1, contact_label: "t" });
  assert.equal(ok, false);
});

test("validateWebLead rejects whitespace-only product_code", () => {
  const { ok, errors } = validateWebLead({ product_code: "   ", quantity: 1, contact_label: "t" });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("product_code")));
});

test("validateWebLead rejects product_code longer than 100 chars", () => {
  const { ok, errors } = validateWebLead({
    product_code: "x".repeat(101),
    quantity: 1,
    contact_label: "t",
  });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("product_code")));
});

test("validateWebLead accepts product_code of exactly 100 chars", () => {
  const { ok } = validateWebLead({
    product_code: "x".repeat(100),
    quantity: 1,
    contact_label: "t",
  });
  assert.equal(ok, true);
});

// ── quantity ──────────────────────────────────────────────────────────────────

test("validateWebLead rejects missing quantity", () => {
  const { ok, errors } = validateWebLead({ product_code: "abc", contact_label: "t" });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("quantity")));
});

test("validateWebLead rejects quantity of zero", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 0, contact_label: "t" });
  assert.equal(ok, false);
});

test("validateWebLead rejects negative quantity", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: -1, contact_label: "t" });
  assert.equal(ok, false);
});

test("validateWebLead rejects non-integer quantity", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 1.5, contact_label: "t" });
  assert.equal(ok, false);
});

test("validateWebLead rejects string quantity", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: "3", contact_label: "t" });
  assert.equal(ok, false);
});

test("validateWebLead rejects quantity above 10000", () => {
  const { ok, errors } = validateWebLead({ product_code: "abc", quantity: 10001, contact_label: "t" });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("quantity")));
});

test("validateWebLead accepts quantity of 10000", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 10000, contact_label: "t" });
  assert.equal(ok, true);
});

test("validateWebLead accepts quantity of 1", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 1, contact_label: "t" });
  assert.equal(ok, true);
});

// ── comment (optional) ────────────────────────────────────────────────────────

test("validateWebLead accepts missing comment", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 1, contact_label: "t" });
  assert.equal(ok, true);
});

test("validateWebLead rejects comment longer than 500 chars (trimmed)", () => {
  const { ok, errors } = validateWebLead({
    product_code: "abc",
    quantity: 1,
    contact_label: "t",
    comment: "x".repeat(501),
  });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("comment")));
});

test("validateWebLead accepts comment of exactly 500 chars", () => {
  const { ok } = validateWebLead({
    product_code: "abc",
    quantity: 1,
    contact_label: "t",
    comment: "x".repeat(500),
  });
  assert.equal(ok, true);
});

test("validateWebLead trims comment before length check", () => {
  // 501 chars of spaces should be effectively empty after trim, length = 0
  const { ok } = validateWebLead({
    product_code: "abc",
    quantity: 1,
    contact_label: "t",
    comment: " ".repeat(501),
  });
  // Whitespace-only trims to 0 chars, which is ≤ 500 → valid
  assert.equal(ok, true);
});

// ── contact_label ─────────────────────────────────────────────────────────────

test("validateWebLead rejects missing contact_label", () => {
  const { ok, errors } = validateWebLead({ product_code: "abc", quantity: 1 });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("contact_label")));
});

test("validateWebLead rejects whitespace-only contact_label", () => {
  const { ok } = validateWebLead({ product_code: "abc", quantity: 1, contact_label: "   " });
  assert.equal(ok, false);
});

test("validateWebLead rejects contact_label longer than 500 chars (trimmed)", () => {
  const { ok, errors } = validateWebLead({
    product_code: "abc",
    quantity: 1,
    contact_label: "x".repeat(501),
  });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("contact_label")));
});

test("validateWebLead accepts contact_label of exactly 500 chars", () => {
  const { ok } = validateWebLead({
    product_code: "abc",
    quantity: 1,
    contact_label: "x".repeat(500),
  });
  assert.equal(ok, true);
});

// ── happy path ────────────────────────────────────────────────────────────────

test("validateWebLead accepts a fully valid payload", () => {
  const { ok, errors } = validateWebLead({
    product_code: "starter-pack",
    quantity: 5,
    comment: "Need it by Friday",
    contact_label: "@user",
  });
  assert.equal(ok, true);
  assert.deepEqual(errors, []);
});

test("validateWebLead returns all errors at once", () => {
  const { ok, errors } = validateWebLead({});
  assert.equal(ok, false);
  // product_code, quantity, contact_label are all required
  assert.ok(errors.length >= 3);
});
