/**
 * Trims a string value. Returns an empty string for non-string inputs.
 */
function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

module.exports = { normalizeText };
