# Frontend Refactoring Plan — Bot_noct Mini App

## Scope
Full frontend improvement: component splitting, bug fixes, UX, CSS, performance, redeploy.

## Phase 1: Component Splitting

### 1.1 Extract hooks
- `webapp/src/hooks/useApi.js` — cache logic, apiRequest, withLoading
- `webapp/src/hooks/useAdminContext.js` — admin state + init

### 1.2 Extract tab components
- `webapp/src/components/LeadsTab.jsx`
- `webapp/src/components/ProductsTab.jsx`
- `webapp/src/components/UsersTab.jsx`
- `webapp/src/components/StatsTab.jsx`

### 1.3 Extract reusable UI components
- `webapp/src/components/ErrorBanner.jsx` — role="alert", auto-dismiss
- `webapp/src/components/EmptyState.jsx` — "no data" message
- `webapp/src/components/ConfirmDialog.jsx` — destructive action confirm
- `webapp/src/components/LoadingSkeleton.jsx` — skeleton placeholder

### 1.4 Rewrite App.jsx
- Thin shell: tab nav, context providers, error boundary

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
