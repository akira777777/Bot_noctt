function requireAdmin(req, res, next) {
  if (!req.auth?.is_admin) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  return next();
}

module.exports = { requireAdmin };
