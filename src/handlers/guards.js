async function rejectBlocked(ctx) {
  await ctx.reply("Ваш аккаунт заблокирован. Обратитесь к администратору.");
}

function createClientAccessGuard(deps) {
  return async function ensureClientAccess(ctx) {
    const user = deps.services.conversation.upsertTelegramUser(ctx.from, "client");
    if (user?.is_blocked) {
      return { ok: false };
    }
    return { ok: true, user };
  };
}

function isAdmin(ctx, deps) {
  return ctx.from.id === deps.adminId;
}

module.exports = {
  rejectBlocked,
  createClientAccessGuard,
  isAdmin,
};
