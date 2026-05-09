# MG Voucher Reconciliation Report

Generated: 2026-05-09T18:28:34.734Z  
Tenant: mg  
Commit verified (FE/BE expected): 46c2fc7

## Voucher IDs And Journal IDs

| Type | Doc No | Amount | Party Code | Transaction ID | Journal Entry ID | Status |
|---|---|---:|---|---|---|---|
| payment | Pay/2026/0001 | 20000 | 101001 | 69ff70cb2a2306793c3ff4ac | 69ff7c7442e9b753defd6560 | posted |
| payment | Pay/2026/0002 | 23000 | 1303 | 69ff70d42a2306793c3ff4fe | 69ff7c6942e9b753defd648f | posted |
| receipt | Rec/2026/0001 | 20000 | 1301 | 69ff70dd2a2306793c3ff550 | 69ff7c8842e9b753defd6736 | posted |
| receipt | Rec/2026/0002 | 27000 | 1301 | 69ff70e62a2306793c3ff5a1 | 69ff7c7e42e9b753defd666b | posted |

## Statement Rows Matched

### Account 101001
- Voucher: Pay/2026/0001
- Type: payment
- Debit: 20000
- Credit: 0
- Signed: 20000
- Date: 2026-05-09T00:00:00.000Z
- Net Balance: 20000 (Debit)

### Account 1303
- Voucher: Pay/2026/0002
- Type: payment
- Debit: 23000
- Credit: 0
- Signed: 23000
- Date: 2026-05-09T00:00:00.000Z
- Net Balance: 23000 (Debit)

### Account 1301
- Voucher: Rec/2026/0001
- Type: receipt
- Debit: 0
- Credit: 20000
- Signed: -20000
- Date: 2026-05-09T00:00:00.000Z
- Voucher: Rec/2026/0002
- Type: receipt
- Debit: 0
- Credit: 27000
- Signed: -27000
- Date: 2026-05-09T00:00:00.000Z
- Net Balance: -47000 (Credit)

## Result
- Overall verification: PASS
- Failure count: 0