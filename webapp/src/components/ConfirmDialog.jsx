/**
 * Confirmation dialog for destructive actions.
 * Uses Telegram native confirm if available, otherwise browser confirm.
 *
 * @param {string} message — text to display
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
  const tg = window.Telegram?.WebApp;

  // Telegram WebApp has showConfirm since Bot API 6.2
  if (tg?.showConfirm) {
    return new Promise((resolve) => {
      tg.showConfirm(message, (confirmed) => resolve(confirmed));
    });
  }

  // Fallback to browser confirm
  return Promise.resolve(window.confirm(message));
}
