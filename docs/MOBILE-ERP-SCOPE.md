# Mobile ERP scope

**Status:** Intentional read-heavy mobile ERP (2026-06-25)

---

## In scope (mobile)

| Feature | Screen / module |
|---------|-----------------|
| ERP reports | `ErpReportsScreen.tsx` — trial balance, P&L, BS, day book, outstanding, forex, ledger |
| Transaction browse | `TransactionsScreen.tsx` — list, filter, status |
| Account enquiry summary | `AccountEnquirySummaryCard.tsx` — ledger/saved-rate summary (no live MTM on mobile ERP) |
| Live metal prices (Home only) | `LiveMetalPricesBar` on Home tab; `LiveMetalRatesContext` SSE stream — not shown on ERP tab |
| Margin widgets | `MarginsWidget.tsx` — `suppressMetalSpotMtm` parity |
| Chat, settings, push | Tabs + admin settings routes |

---

## Web-only (not planned for current mobile release)

| Feature | Web location | Notes |
|---------|--------------|-------|
| Journal vouchers | `ERPLedgerTab`, `JournalVoucherModal` | Money write path — use web |
| Metal / payment vouchers | `VoucherTab.jsx` | Full composer |
| Fixing register | `ERPFixingRegisterTab` | |
| COA, customers, vendors, mappings | ERP sub-tabs | Admin surface |
| Direct deals | `DirectDealsTab` | |
| Transaction create / void / approve | `ERPTransactionsTab` | Mobile is browse-only |

---

## Parity tests

- `mobile/src/utils/marginWidgetHelpers.test.ts` — supplier + liability customer suppression
- `mobile/src/utils/buildAccountEnquiryLiveMetrics.test.ts` — account summary MTM

---

## Future roadmap (if product requests write paths)

1. **Phase A:** Transaction detail view + void (with permissions)
2. **Phase B:** JV create (simplified mobile form)
3. **Phase C:** Metal voucher quick entry

Until then, document in release notes: **“Full ERP posting is on web.”**
