function parseSourcePayload(rawPayload) {
  const payload = rawPayload || "direct";

  const map = {
    from_channel: {
      raw: payload,
      source: "channel",
      intent: "generic",
      title: "Вы пришли из канала",
    },
    quote_channel: {
      raw: payload,
      source: "channel",
      intent: "lead",
      title: "Быстрая заявка из канала",
    },
    support_channel: {
      raw: payload,
      source: "channel",
      intent: "support",
      title: "Связь с менеджером из канала",
    },
    catalog_channel: {
      raw: payload,
      source: "channel",
      intent: "catalog",
      title: "Каталог из канала",
    },
    direct: {
      raw: payload,
      source: "direct",
      intent: "generic",
      title: "Прямой вход в бота",
    },
  };

  return (
    map[payload] || {
      raw: payload,
      source: payload.includes("channel") ? "channel" : "direct",
      intent: "generic",
      title: "Переход по ссылке",
    }
  );
}

function resolveStartAction(entry) {
  if (entry.intent === "catalog") {
    return "catalog";
  }

  if (entry.intent === "lead") {
    return "lead";
  }

  if (entry.intent === "support") {
    return "support";
  }

  return "menu";
}

module.exports = {
  parseSourcePayload,
  resolveStartAction,
};
