# Frontend Refactoring Plan — Bot_noct Admin Web (Next.js)

## Scope

Full frontend improvement: component splitting, bug fixes, UX, CSS, performance, redeploy.

## Phase 1: Component Splitting

### 1.1 Extract hooks

- `web/lib/api.ts` — typed API helpers (public + admin)
- `web/lib/auth.ts` — session/admin helpers for Next.js

### 1.2 Extract tab components

- `web/app/admin/leads/page.tsx`
- `web/app/admin/products/page.tsx`
- `web/app/admin/users/page.tsx`
- `web/app/admin/page.tsx`

### 1.3 Extract reusable UI components

- `web/components/admin/sidebar.tsx`
- `web/components/admin/reply-form.tsx`
- `web/components/admin/lead-status-actions.tsx`
- `web/components/admin/stat-card.tsx`

### 1.4 Rewrite App.jsx

- Thin shell: shared admin layout in `web/app/admin/layout.tsx`

## Phase 2: Bug Fixes (Critical)

- C1: Fix useEffect dependency arrays, wrap handlers in useCallback
- C2: Move module-level Map cache into hook with lifecycle management
- C3: Document initData limitation (session-bound, no refresh)
- H5: Disable action buttons during in-flight requests

## Phase 3: UX Improvements

- Confirmation dialogs for destructive actions (block/unblock, toggle)
- Empty state messages for empty tables (Russian)
- Loading skeletons instead of plain text
- Consistent Russian language across UI
- Input validation on product form (name required, price > 0)
- Disable submit during form submission

## Phase 4: CSS & Responsiveness

- Replace hardcoded colors with Telegram CSS variables
- overflow-x: auto wrapper for tables on mobile
- focus-visible styles for keyboard nav
- role="alert" on error banner

## Phase 5: Performance Optimization

- Parallel data loading: Promise.all([loadAdmin(), loadTabData()])
- useCallback/useMemo for handlers and computed values
- Remove unused useCallback import
- Cache lifecycle tied to component, not module scope

## Phase 6: Redeploy

- npm run build:web — verify no errors
- Deploy to Vercel production via CLI

## File Changes

- New: ~8 files (4 tab components + 4 shared components/hooks)
- Modified: 3 (App.jsx rewrite, styles.css, api.js)
- Deleted: 0

## Risk

- Low — frontend only, backend untouched
- Rollback: revert to current commit
