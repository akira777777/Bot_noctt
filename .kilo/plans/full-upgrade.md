# Bot_noct — Full Upgrade Plan

## Phase 1: Cleanup & Foundation (Low risk, immediate value)

| # | Task | Details |
|---|------|---------|
| 1.1 | Delete `nul` file | Accidental Windows artifact in root |
| 1.2 | Add `.editorconfig` | Enforce consistent formatting (2-space indent, UTF-8, LF) |
| 1.3 | Add ESLint + Prettier | `eslint.config.mjs` with recommended rules; `.prettierrc`; add `lint` and `format` scripts |
| 1.4 | Normalize logging | Replace all `console.warn`/`console.error` with the existing `src/utils/logger.js` |
| 1.5 | Fix broken test | `test/debug-ingest.test.js` references removed module — fix or remove |

## Phase 2: Security Hardening (High priority)

| # | Task | Details |
|---|------|---------|
| 2.1 | Input sanitization | Create `src/utils/sanitize.js` — escape HTML entities in user text before forwarding/storing |
| 2.2 | Rate limiting (API) | Add `express-rate-limit` to `/api` routes (100 req/min per user) |
| 2.3 | Rate limiting (Bot) | Telegraf middleware to throttle commands per user (30 commands/min) |
| 2.4 | Helmet middleware | Add `helmet` to Express for standard security headers |
| 2.5 | Validate ADMIN_ID strictly | Ensure ADMIN_ID is a valid positive integer at startup in `src/config/env.js` |
| 2.6 | Audit DB inputs | Verify all repository prepared statements use parameterized queries (no string interpolation) |

## Phase 3: Stability & Error Handling

| # | Task | Details |
|---|------|---------|
| 3.1 | Centralized error handler | Express error-handling middleware in `src/web/middleware/error-handler.js` |
| 3.2 | Bot error middleware | Improve `bot.catch()` — structured logging, optional admin notification |
| 3.3 | Session timeout config | Make session expiry configurable via `SESSION_TIMEOUT_MS` env var (default 86400000) |
| 3.4 | Health check enhancement | Extend `/healthz` to report DB status, uptime, memory usage |
| 3.5 | Request timeout | Add timeout middleware to Express (30s default, configurable) |

## Phase 4: Feature Improvements

| # | Task | Details |
|---|------|---------|
| 4.1 | Media message handling | Forward photo, document, sticker, voice, video_note between client↔admin |
| 4.2 | Pagination for leads/dialogs | Add prev/next inline buttons to admin lead and dialog lists |
| 4.3 | Multi-admin support | Parse comma-separated `ADMIN_ID`; each admin gets independent inbox; `isAdmin()` helper |
| 4.4 | Contact validation | Regex validation for phone/email in lead wizard with error messages |
| 4.5 | Lead search | `/search <query>` admin command — full-text search across leads |
| 4.6 | Notification preferences | `/mute` / `/unmute` admin commands with DB-backed preference storage |

## Phase 5: Code Quality & Architecture

| # | Task | Details |
|---|------|---------|
| 5.1 | JSDoc annotations | Add JSDoc to all public functions in services, repositories, handlers |
| 5.2 | Constants extraction | Extract magic strings/numbers into `src/config/constants.js` |
| 5.3 | Handler refactoring | Split `handlers/admin.js` into `admin/leads.js`, `admin/dialogs.js`, `admin/products.js`, `admin/stats.js`; split `handlers/client.js` similarly |
| 5.4 | Service layer tests | Unit tests for lead-service, admin-service, conversation-service |
| 5.5 | Integration test improvements | E2E test for lead creation flow, conversation flow, admin actions |

## Phase 6: Dependency Updates

| # | Task | Details |
|---|------|---------|
| 6.1 | Update telegraf | `^4.16.3` → latest 4.x |
| 6.2 | Update express | `^4.21.2` → latest 4.x |
| 6.3 | Update vite + React | Vite 8 → latest; React 18.3.1 → latest 18.x or 19 if compatible |
| 6.4 | npm audit fix | Fix any known vulnerabilities |

## Phase 7: DevOps & CI/CD

| # | Task | Details |
|---|------|---------|
| 7.1 | GitHub Actions CI | `.github/workflows/ci.yml` — lint → test → build on push/PR |
| 7.2 | Automated backup docs | Document Render cron job or external scheduler for SQLite backups |
| 7.3 | Webhook mode option | Add `USE_WEBHOOK` env var; configure Telegraf webhook mode for production |
| 7.4 | Environment validation | Fail-fast at startup with clear messages for missing/invalid env vars |

## Execution Order

| Phase | Risk | Effort | Dependencies |
|-------|------|--------|-------------|
| Phase 1 | Low | ~1h | None |
| Phase 2 | Low-Medium | ~2h | Phase 1 |
| Phase 3 | Low | ~1.5h | Phase 1 |
| Phase 4 | Medium | ~4h | Phases 1-3 |
| Phase 5 | Low | ~3h | Phases 1-3 |
| Phase 6 | Medium | ~1.5h | After Phase 5 |
| Phase 7 | Low | ~1.5h | After Phase 6 |

**Total: ~14.5 hours**

## New Dependencies to Add

| Package | Purpose | Phase |
|---------|---------|-------|
| `express-rate-limit` | API rate limiting | 2 |
| `helmet` | Security headers | 2 |
| `eslint` | Linting (dev) | 1 |
| `prettier` | Formatting (dev) | 1 |
| `@eslint/js` | ESLint config (dev) | 1 |
| `globals` | ESLint globals (dev) | 1 |

## Files to Create

| File | Purpose | Phase |
|------|---------|-------|
| `.editorconfig` | Editor formatting rules | 1 |
| `eslint.config.mjs` | ESLint flat config | 1 |
| `.prettierrc` | Prettier config | 1 |
| `src/utils/sanitize.js` | HTML entity escaping | 2 |
| `src/web/middleware/error-handler.js` | Express error handler | 3 |
| `src/web/middleware/rate-limit.js` | Rate limit config | 2 |
| `src/middleware/bot-rate-limit.js` | Bot command throttling | 2 |
| `src/config/constants.js` | Extracted constants | 5 |
| `src/handlers/admin/leads.js` | Admin lead handlers | 5 |
| `src/handlers/admin/dialogs.js` | Admin dialog handlers | 5 |
| `src/handlers/admin/products.js` | Admin product handlers | 5 |
| `src/handlers/admin/stats.js` | Admin stats handlers | 5 |
| `src/handlers/admin/index.js` | Admin handler aggregator | 5 |
| `.github/workflows/ci.yml` | CI pipeline | 7 |
