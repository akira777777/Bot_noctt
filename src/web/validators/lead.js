function validateWebLead(body) {
  const errors = [];

  if (!body.product_code || typeof body.product_code !== "string") {
    errors.push("product_code is required");
  }

  if (!body.quantity || !Number.isInteger(body.quantity) || body.quantity <= 0) {
    errors.push("quantity must be a positive integer");
  }

  if (body.comment && typeof body.comment === "string" && body.comment.length > 500) {
    errors.push("comment must be 500 characters or less");
  }

  if (!body.contact_label || typeof body.contact_label !== "string" || !body.contact_label.trim()) {
    errors.push("contact_label is required");
  } else if (body.contact_label.length > 500) {
    errors.push("contact_label must be 500 characters or less");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateWebLead };
