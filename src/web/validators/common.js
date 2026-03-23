function toPositiveInt(rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(Math.max(1, Number(query.limit) || 50), 500);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = {
  toPositiveInt,
  parsePagination,
};
