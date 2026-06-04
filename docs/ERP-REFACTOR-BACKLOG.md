# ERP refactor backlog (line-budget guardrails)

CI enforces maximum line counts in [scripts/check-risk-guardrails.mjs](../scripts/check-risk-guardrails.mjs):

| File | Budget | Purpose |
|------|--------|---------|
| [frontend/src/components/tabs/ERPTab.jsx](../frontend/src/components/tabs/ERPTab.jsx) | 8,400 | Main ERP shell; already split across `erp/`, `erpTabConstants`, `erpTabUtils`, tab components |
| [backend/routes/erp-accountingContext.js](../backend/routes/erp-accountingContext.js) | 2,400 | Route registration and shared context for ERP accounting |

When you approach a budget, **extract** before adding large features.

## Phase A — ERPTab.jsx (frontend)

Priorities (repeat until headroom is comfortable):

1. **Tab-specific state** — Move any remaining local `useState` clusters into `frontend/src/components/tabs/erp/useERPTabStateAdapter.js` or per-tab hooks under `erp/hooks/`.
2. **Pure helpers** — Move formatting, list shaping, and CSV/print helpers that still live in ERPTab into `erpTabUtils.js`, `exportHelpers.js`, or `utils/` with unit tests where cheap.
3. **Lazy boundaries** — Keep heavy tabs behind `lazy` + `Suspense` (already started); avoid new synchronous imports of large subtrees at the top of ERPTab.
4. **Constants** — Any new magic strings or widget keys belong in [erpTabConstants.js](../frontend/src/components/tabs/erpTabConstants.js) or `constants/`.

## Phase B — erp-accountingContext.js (backend)

Priorities:

1. **New routes** — Add handlers only via existing `register*Routes` modules under `backend/routes/erp-accounting/`; avoid growing the context file for single-endpoint logic.
2. **Shared services** — Push orchestration into `backend/services/erpAccounting/` with thin route wrappers.
3. **Imports** — If the import block grows, group re-exports from a barrel file *only* if it does not obscure dependency direction (prefer explicit imports from services).

## Phase C — Verification

After each extraction PR:

- `npm run check:risk-guardrails`
- `npm run test:frontend` / `npm run test:backend` as appropriate for touched areas

## Related

- [FRONTEND-LINT-SCOPE.md](./FRONTEND-LINT-SCOPE.md)
- [OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md)
