# Manual Test Checklist

## Preconditions

- `npm test` passes.
- `npm run test:coverage` passes.
- `npm run build:web` was executed for Mini App checks.
- `npm run smoke:api` passes.
- Bot is running locally.
- `ADMIN_ID` points to the admin account.
- Client and admin are tested from different Telegram accounts.

For rollback/recovery operations, use `docs/runbook.md`.

## Channel Entry

- Open `?start=from_channel`.
  Expected: generic channel welcome and home actions.

- Open `?start=quote_channel`.
  Expected: channel welcome plus fast path into lead-oriented UX.

- Open `?start=support_channel`.
  Expected: support-oriented welcome and message-to-manager prompt.

- Open `?start=catalog_channel`.
  Expected: catalog opens after the welcome message.

## Client Menu

- Tap each top-level action from the client chat.
  Expected: every screen clearly explains the next step.

- Return to main menu from inline `Главное меню`.
  Expected: home screen reappears and source context stays intact.

## Catalog

- Open catalog.
  Expected: product list appears.

- Open a product card.
  Expected: description, price, and CTA are shown.

## Lead Flow

- Start a lead from main menu.
- Choose a product.
- Enter invalid quantity.
  Expected: validation error.

- Enter valid quantity.
  Expected: move to comment step.

- Skip comment.
  Expected: move to contact selection step.

- Choose `Ответить в Telegram`.
  Expected: move to confirmation step with source and contact label.

- Confirm.
  Expected:
  - lead is stored in SQLite;
  - session is cleared;
  - admin receives a lead card;
  - client sees success message.

- Start another lead and choose `Указать другой контакт`.
  Expected: custom contact text is requested and saved.

- Use `Назад` and `Отмена` in the lead flow.
  Expected: step navigation works and cancellation returns to home state.

## Support Messages

- Send a free-text message from the client outside the lead flow.
  Expected:
  - conversation is created or updated;
  - admin receives message card;
  - client sees delivery confirmation.

## Admin Inbox

- Run `/dialogs`.
  Expected: inbox list with recent dialogs and last message context.

- Open a dialog from inline `Открыть`.
  Expected: active client is selected.

- Send admin reply text.
  Expected:
  - client receives admin message;
  - message is logged into `messages`.

- Send quick template.
  Expected: template is delivered to the selected client.

## Lead Status Workflow

- Create a fresh lead and verify the initial stored/admin-visible status is `new`.

- Press `Взять в работу` on a lead card.
  Expected:
  - lead status becomes `in_progress`;
  - client receives "taken in work" notification.

- Press `📞 Перезвонили`.
  Expected:
  - lead status becomes `called_back`;
  - client receives callback notification.

- Press `💳 Ждём оплату`.
  Expected:
  - lead status becomes `awaiting_payment`;
  - client receives payment-waiting notification.

- Press `✅ Выполнена`.
  Expected:
  - lead status becomes `fulfilled`;
  - client receives fulfillment notification.

- Press `Закрыть заявку`.
  Expected:
  - lead status becomes `closed`;
  - client receives closure notification.

## Restart Safety

- Stop the bot.
- Start the bot again.
- Re-run `/dialogs` and `/leads`.
  Expected:
  - stored dialogs remain;
  - lead statuses remain;
  - products remain available.
