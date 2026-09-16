# LoopC Structured Payroll — Acceptance Checklist

Use on tenant **`loopc` only**. Confirm another tenant (e.g. `mg` / `cg`) still shows legacy Payroll Management KPIs only.

## Capability gate
- [ ] Backend `isStructuredPayrollEnabled('loopc')` is true; other tenants false
- [ ] Frontend `isStructuredPayrollEnabled(company)` shows structured tabs only on LoopC
- [ ] `GET /api/finance/payroll-v2/dashboard` returns **403** for non-loopc

## Employee + salary
- [ ] HR → Employee List → open **Profile** (LoopC)
- [ ] Edit Personal / Employment fields; save persists
- [ ] Salary & Payroll: empty state when no structure; save earnings/deductions/employer components
- [ ] Re-save bumps assignment version; does not silently overwrite without user action

## Payroll run
- [ ] Finance → Payroll Management → Dashboard shows live counts (not demo KPIs)
- [ ] Create draft run for year/month (unique per period)
- [ ] Select employees → Calculate → Submit review → Approve → Finalize
- [ ] Invalid skip-ahead transitions rejected
- [ ] FINALIZED run cannot change employee selection

## Payslips
- [ ] Generate All on FINALIZED run creates numbers `LOPC-PS-YYYY-MM-######`
- [ ] Second Generate All skips existing (idempotent)
- [ ] PDF download works; bank masked; employer section separate from net
- [ ] Reissue creates new number and marks prior as REISSUED

## Self-service + audit
- [ ] User with matching `employeeCode` sees only own FINALIZED/PAID slips under My Payslips
- [ ] Query params cannot expand another employee’s slips
- [ ] Audit log entries exist for salary change, run lifecycle, generate/download/reissue

## Migration report
- [ ] `node backend/scripts/payroll-loopc-migration-report.js` writes markdown report (read-only)
- [ ] Optional `--backfill` only creates assignments for unique name matches; flags ambiguous

## Non-regression
- [ ] `mg` / `cg` / `vb` Payroll Management unchanged (demo KPIs + FinancePayroll register)
- [ ] Existing FinancePayroll rows on LoopC still visible under **Legacy register**

## August 2026 LOPC payroll (confirmed 24 payable days)
- [ ] Seed: `node backend/scripts/payroll-loopc-aug2026-seed.js` (idempotent; upserts Aneesh/Biju/Sudheesh/Anil by name)
- [ ] Joining date 07-Aug-2026; monthly salaries 80k / 80k / 65k / 65k (not 50k)
- [ ] Payable days = **24** (not recalculated to 25)
- [ ] Earned: Aneesh/Biju ₹61,935.48; Sudheesh/Anil ₹50,322.58
- [ ] Paid ₹50,000 each; balances ₹11,935.48 / ₹11,935.48 / ₹322.58 / ₹322.58
- [ ] Totals: earned ₹224,516.12 · paid ₹200,000 · outstanding ₹24,516.12
- [ ] Salary Balances tab shows arrears (not advances)
- [ ] Partial then full balance payment → PARTIALLY_PAID → PAID; August earned unchanged
- [ ] Employee Advances module separate; creating an advance does not alter Aug balances
- [ ] Payslip PDF shows monthly, payable days, earned, paid, salary balance (arrears label)
