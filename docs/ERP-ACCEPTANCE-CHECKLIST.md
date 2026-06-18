# ERP refactor acceptance checklist

Run after major ERP/Voucher refactors on **mg** and **loopc** production (or staging when available). Mark each tenant: Pass / Fail / N/A.

Reference: [`ERP-TAB-REFACTOR-ROADMAP.md`](ERP-TAB-REFACTOR-ROADMAP.md)

**Deploy `e805f1f` (ERP tab refactor):** checklist below is the operator sign-off template. Complete manually on mg and loopc; CI cannot substitute for voucher print / JV FX validation.

## Account enquiry

- [ ] Open Account Summary / enquiry modal for a **creditor/vendor** payable account — spot MTM is suppressed (no misleading metal revaluation on pure payable balance).
- [ ] Open enquiry for a **customer** metal account — MTM and position rows look correct.
- [ ] Full statement: pure-weight running balance dedupes merged legs (no duplicate gram rows for same voucher leg).
- [ ] Statement filters (metal, currency, date) still apply; export PDF / view statement works.

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
