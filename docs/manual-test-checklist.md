# Manual Test Checklist

## Preconditions

- `npm test` passes
- `npm run build:web` passes
- `npm run smoke:api` passes
- Bot is running locally when testing Telegram flows
- `ADMIN_ID` points to the admin account
- Client and admin are tested from different Telegram accounts

For rollback and recovery procedures, use `docs/runbook.md`.

## Channel Entry

- Open `?start=from_channel`
  Expected: neutral welcome and main menu

- Open `?start=quote_channel`
  Expected: welcome plus fast path into request flow

- Open `?start=support_channel`
  Expected: support-oriented welcome and prompt to contact a manager

- Open `?start=catalog_channel`
  Expected: catalog opens after the welcome message

## Client Menu

- Tap each top-level action in the client chat
  Expected: each screen clearly explains the next step

- Return via `Главное меню`
  Expected: home screen reappears and source context is preserved

## Catalog

- Open catalog
  Expected: active positions are listed

- Open a position card
  Expected: description, price text, and action button are shown

## Request Flow

- Start a new request from the main menu
- Choose a position
- Enter invalid quantity
  Expected: validation error

- Enter valid quantity
  Expected: move to comment step

- Skip comment
  Expected: move to contact selection

- Choose `Ответить в Telegram`
  Expected: move to confirmation with source and contact label

- Confirm
  Expected:
  - request is stored in SQLite
  - session is cleared
  - admin receives a request card
  - client sees confirmation

- Start another request and choose `Указать другой контакт`
  Expected: custom contact text is requested and saved

- Use `Назад` and `Отмена`
  Expected: navigation works and cancellation returns to the home state

## Support Messages

- Send free text outside the request flow
  Expected:
  - conversation is created or updated
  - admin receives the message card
  - client sees delivery confirmation

## Admin Inbox

- Run `/dialogs`
  Expected: recent dialogs with last-message context

- Open a dialog via `Открыть`
  Expected: active client is selected

- Send an admin reply
  Expected:
  - client receives the message
  - message is stored in `messages`

- Send a quick template
  Expected: template is delivered to the selected client

## Request Status Workflow

- Create a fresh request
  Expected: initial status is `new`

- Press `Взять в работу`
  Expected:
  - status becomes `in_progress`
  - client receives an in-progress notification

- Press `📞 Перезвонили`
  Expected:
  - status becomes `called_back`
  - client receives a callback notification

- Press `📄 Предложение отправлено`
  Expected:
  - status becomes `proposal_sent`
  - client receives a proposal notification

- Press `✅ Выполнена`
  Expected:
  - status becomes `fulfilled`
  - client receives a completion notification

- Press `Закрыть заявку`
  Expected:
  - status becomes `closed`
  - client receives a closure notification

## Restart Safety

- Stop the bot
- Start the bot again
- Re-run `/dialogs` and `/leads`
  Expected:
  - dialogs remain
  - request statuses remain
  - catalog positions remain available

## API-Only Mode

- Start with `BOT_ENABLED=false`
- Call `/healthz` and `/api/catalog`
  Expected: both endpoints work without `BOT_TOKEN`

- Try admin reply API without Telegram runtime
  Expected: endpoint returns `503` with a clear Telegram-disabled error
