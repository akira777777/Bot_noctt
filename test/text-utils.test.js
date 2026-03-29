const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeText } = require("../src/utils/text");

test("normalizeText trims leading and trailing whitespace", () => {
  assert.equal(normalizeText("  hello  "), "hello");
});

test("normalizeText trims tabs and newlines", () => {
  assert.equal(normalizeText("\t hello \n"), "hello");
});

test("normalizeText returns empty string for empty string input", () => {
  assert.equal(normalizeText(""), "");
});

test("normalizeText returns empty string for whitespace-only string", () => {
  assert.equal(normalizeText("   "), "");
});

test("normalizeText returns empty string for null input", () => {
  assert.equal(normalizeText(null), "");
});

test("normalizeText returns empty string for undefined input", () => {
  assert.equal(normalizeText(undefined), "");
});

test("normalizeText returns empty string for number input", () => {
  assert.equal(normalizeText(42), "");
});

test("normalizeText returns empty string for boolean input", () => {
  assert.equal(normalizeText(true), "");
});

test("normalizeText returns empty string for object input", () => {
  assert.equal(normalizeText({}), "");
});

test("normalizeText returns empty string for array input", () => {
  assert.equal(normalizeText([]), "");
});

test("normalizeText preserves internal whitespace", () => {
  assert.equal(normalizeText("  hello world  "), "hello world");
});

test("normalizeText does not modify a string with no whitespace", () => {
  assert.equal(normalizeText("hello"), "hello");
});
