function createApiKeyAuth({ apiSecret }) {
  return function apiKeyAuth(req, res, next) {
    if (!apiSecret) {
      return next();
    }

    const provided = req.headers["x-api-key"];
    if (!provided || provided !== apiSecret) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    next();
  };
}

module.exports = { createApiKeyAuth };
