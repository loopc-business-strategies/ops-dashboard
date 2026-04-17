# ERP API Smoke Test

Run one command from backend:

npm run smoke:erp

Optional overrides:

- SMOKE_API_BASE_URL
- SMOKE_LOGIN_NAME
- SMOKE_LOGIN_PASSWORD
- SMOKE_LEDGER_DEPARTMENT
- SMOKE_LEDGER_REFERENCE_TYPE
- SMOKE_LEDGER_LIMIT

PowerShell example:

$env:SMOKE_LOGIN_NAME="AdminUser"
$env:SMOKE_LOGIN_PASSWORD="admin123"
$env:SMOKE_LEDGER_DEPARTMENT="sales"
$env:SMOKE_LEDGER_REFERENCE_TYPE="invoice"
$env:SMOKE_LEDGER_LIMIT="5"
npm run smoke:erp
