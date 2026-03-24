function validateWebLead(body) {
  const errors = [];

  if (!body.product_code || typeof body.product_code !== "string" || !body.product_code.trim()) {
    errors.push("product_code is required");
  } else if (body.product_code.trim().length > 100) {
    errors.push("product_code must be 100 characters or less");
  }

  if (!body.quantity || !Number.isInteger(body.quantity) || body.quantity <= 0) {
    errors.push("quantity must be a positive integer");
  } else if (body.quantity > 10000) {
    errors.push("quantity must be 10000 or less");
  }

  if (body.comment && typeof body.comment === "string" && body.comment.trim().length > 500) {
    errors.push("comment must be 500 characters or less");
  }

  if (!body.contact_label || typeof body.contact_label !== "string" || !body.contact_label.trim()) {
    errors.push("contact_label is required");
  } else if (body.contact_label.trim().length > 500) {
    errors.push("contact_label must be 500 characters or less");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateWebLead };
