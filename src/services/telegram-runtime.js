function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]);
}

function createErrorPayload(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    value: String(error),
  };
}

function attachBackgroundErrorLogger(promise, log, context) {
  promise.catch((error) => {
    if (log?.error) {
      log.error(context, {
        error: createErrorPayload(error),
      });
    }
  });
}

async function launchPollingRuntime({ bot, timeoutMs, log }) {
  const botInfo = await withTimeout(
    bot.telegram.getMe(),
    timeoutMs,
    "telegram.getMe",
  );
  bot.botInfo = botInfo;

  await withTimeout(
    bot.telegram.deleteWebhook({ drop_pending_updates: false }),
    timeoutMs,
    "deleteWebhook",
  );

  const pollingPromise = bot.startPolling();
  attachBackgroundErrorLogger(
    pollingPromise,
    log,
    "Bot polling loop stopped unexpectedly",
  );

  return {
    mode: "polling",
    details: {
      username: botInfo.username,
    },
  };
}

async function launchWebhookRuntime({
  bot,
  webhookDomain,
  botToken,
  timeoutMs,
}) {
  const webhookUrl = `${webhookDomain}/webhook/${botToken}`;
  await withTimeout(bot.telegram.setWebhook(webhookUrl), timeoutMs, "setWebhook");

  return {
    mode: "webhook",
    details: {
      webhookUrl,
    },
  };
}

async function launchTelegramRuntime({
  bot,
  webhookEnabled,
  webhookDomain,
  botToken,
  timeoutMs,
  log,
}) {
  if (webhookEnabled) {
    return launchWebhookRuntime({
      bot,
      webhookDomain,
      botToken,
      timeoutMs,
    });
  }

  return launchPollingRuntime({
    bot,
    timeoutMs,
    log,
  });
}

module.exports = {
  launchTelegramRuntime,
  withTimeout,
};
