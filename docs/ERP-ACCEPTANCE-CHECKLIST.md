# ERP refactor acceptance checklist

Run after major ERP/Voucher refactors on **mg**, **loopc**, and **cg** production (or staging when available). Mark each tenant: Pass / Fail / N/A.

Reference: [`ERP-TAB-REFACTOR-ROADMAP.md`](ERP-TAB-REFACTOR-ROADMAP.md)

**Deploy `c33d27c`+ (dashboard deep links + unified URL builder):** complete operator sign-off below. Automated coverage:

| Check | Automated |
|-------|-----------|
| URL builder unit tests | `frontend/src/utils/dashboardNavigation.node.test.js` |
| Dashboard navigation Vitest | `frontend/src/__tests__/dashboard-navigation.test.jsx` |
| Enquiry deep-link hook | `frontend/src/__tests__/useEnquiryDeepLinkEffects.test.jsx` |
| Playwright deep links | `frontend/e2e/dashboard-navigation.spec.js` |
| Post-deploy SPA shell | `npm run smoke:tenants` (dashboard `?tab=erp-enquiry&account=…`) |

CI cannot substitute for voucher print / JV FX validation on live tenants.

## Dashboard deep links (new)

- [ ] Sidebar item **Open in new tab** restores the same module/ERP sub-tab without logout.
- [ ] Account Summary **Load Summary** / **View Statement** open in new tab with `account` (+ optional `view=statement`) preserved.
- [ ] Re-clicking **Account Summary** in the sidebar while viewing an account does **not** strip `account` / `view` from the URL.
- [ ] Overview KPI / department links update the URL (`?tab=…`) and support open in new tab.
- [ ] Account autocomplete dropdown entries open in new tab with the correct account code in the URL.

## Account enquiry

- [ ] Open Account Summary / enquiry modal for a **creditor/vendor** payable account — spot MTM is suppressed (no misleading metal revaluation on pure payable balance).
- [ ] Open enquiry for a **customer** metal account — MTM and position rows look correct.
- [ ] Full statement: pure-weight running balance dedupes merged legs (no duplicate gram rows for same voucher leg).
- [ ] Statement filters (metal, currency, date) still apply; export PDF / view statement works.
- [ ] **View Statement** opens in-tab draggable preview (not a new browser window).

## Vouchers

- [ ] Create or open a **metal** voucher — editor loads, save works.
- [ ] Create or open a **non-metal** voucher — unchanged layout.
- [ ] **Print** preview matches prior layout (doc no, lines, totals).

## Journal voucher

- [ ] New JV: balanced lines save successfully.
- [ ] **LoopC** tenant: header currency + line amounts save with correct FX (header-currency path).
- [ ] Bank JV mode: bank account combobox filters correctly.

## Dashboard

- [ ] Open ERP **Dashboard** tab once — widgets load.
- [ ] Switch away and back — no runaway polling (network tab: no repeating dashboard fetch loop).

## Fixing register

- [ ] Run fixing register report — results and opening balance match prior behavior.
- [ ] Drag filter panel — position resets when leaving tab.

## Sign-off

| Tenant | Tester | Date | Notes |
|--------|--------|------|-------|
| mg | | | |
| loopc | | | |
| cg | | | |
