# Mini App Admin MVP QA

## Smoke checks

- [x] Web modules load:
  - `node -e "require('./src/web/server'); require('./src/web/routes/api'); require('./src/web/middleware/verify-telegram-init-data'); console.log('web-modules-ok')"`
- [x] Env config parses:
  - `node -e "require('./src/config/env'); console.log('env-ok')"`
- [x] Frontend build:
  - `npm run build:web`
- [x] Health endpoint:
  - `GET /healthz` returns `{\"ok\":true,\"service\":\"bot_noct_web\"}`
- [x] Telegram auth middleware + admin endpoint:
  - `node scripts/smoke-miniapp-api.js` returns HTTP 200 for `/api/admin/me`

## Manual checks after deploy

- [ ] Open bot `/start` as admin and verify button **Открыть Mini App админки** exists.
- [ ] Open Mini App in Telegram and verify tabs: Leads, Products, Users, Stats.
- [ ] Change lead status in Mini App and verify DB/bot consistency.
- [ ] Block/unblock user and verify client blocking behavior in chat.
- [ ] Verify non-admin cannot pass API authorization (`403`).
