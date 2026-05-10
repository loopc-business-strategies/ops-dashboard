# Project Endpoint Matrix

Generated: 2026-05-11
Scope: backend route ownership, frontend tab-to-endpoint dependencies, and method-level permissions.

## 1) Backend Route Responsibility Matrix

| Backend Route File | Mounted Prefix | Responsibility | Endpoint Families |
|---|---|---|---|
| backend/routes/auth.js | /api/auth | Authentication, session lifecycle, and user administration | /setup, /login, /me, /logout, /refresh, /users, /users/:id/role, /users/:id/permissions, /users/:id/toggle |
| backend/routes/employees.js | /api/hr/employees | HR employee records | /, /:id |
| backend/routes/tasks.js | /api/tasks | Cross-department tasks with comments and notifications | /, /:id, /:id/comments |
| backend/routes/attendance.js | /api/attendance | Attendance records, summaries, and leave workflow | /records, /summary, /me, /leave, /leave/:id/decision |
| backend/routes/messages.js | /api/messages | Group and DM messaging | /latest, / |
| backend/routes/realtime.js | /api/realtime | Realtime stream for UI updates | /events |
| backend/routes/department-state.js | /api/department-state | Persisted UI/module state | /:module |
| backend/routes/crm.js | /api/crm | CRM for contacts, companies, leads, deals, activities, followups, import/export, templates | /dashboard, /contacts*, /companies*, /leads*, /deals*, /activities*, /followups, /templates/*, /import, /export |
| backend/routes/erp.js | /api/erp | Operational ERP: inventory, suppliers, purchase orders, production work orders, finance records, procurement docs, expiry alerts | /inventory*, /procurement/suppliers*, /procurement/purchase-orders*, /production/work-orders*, /finance/records*, /procurement/documents*, /alerts/expiry* |
| backend/routes/finance.js | /api/finance | Finance domain CRUD groups | /invoices*, /expenses*, /payroll*, /budgets*, /taxes* |
| backend/routes/compliance.js | /api/compliance | Compliance domain CRUD groups | /eligibility*, /approvals*, /docs*, /updates*, /agreements* |
| backend/routes/training.js | /api/training | Training domain CRUD groups | /sessions*, /batches*, /attendance*, /resources*, /assessments*, /certs*, /feedback*, /trainees* |
| backend/routes/erp-accounting.js | /api/erp-accounting | Accounting aggregation route and registrar wiring | Delegates to sub-modules below |

### ERP Accounting Sub-Modules

| Route File | Endpoint Families |
|---|---|
| backend/routes/erp-accounting/accountsRoutes.js | /accounts*, /accounts/enquiry, /accounts/bulk-seed, /accounts/hard-delete-by-code |
| backend/routes/erp-accounting/ledgerRoutes.js | /ledger*, reconcile/permanent delete helpers |
| backend/routes/erp-accounting/mappingsRoutes.js | /mappings* |
| backend/routes/erp-accounting/currencyRoutes.js | /currencies*, /currencies/seed-defaults, /report-branding, /metal-rates |
| backend/routes/erp-accounting/transactionRoutes.js | /transactions* including workflow/actions/comments/attachments |
| backend/routes/erp-accounting/reportRoutes.js | /reports/trial-balance, /reports/ledger, /reports/profit-loss, /reports/balance-sheet, /reports/day-book, /reports/customer-outstanding, /reports/vendor-outstanding, /reports/forex-gain-loss, /reports/dashboard |
| backend/routes/erp-accounting/customerRoutes.js | /customers*, /customers/:id/aging |
| backend/routes/erp-accounting/vendorRoutes.js | /vendors*, /vendors/compliance-summary, /vendors/alerts/overdue-queue, /vendors/:id/details, /vendors/:id/workflow, /vendors/:id/documents*, /vendors/payment-calendar |
| backend/routes/erp-accounting/inventoryRoutes.js | /inventory/products*, /inventory/stock-in, /inventory/stock-out, /inventory/stock-ledger |
| backend/routes/erp-accounting/directDealsRoutes.js | /direct-deals* |
| backend/routes/erp-accounting/attachmentRoutes.js | /attachments/download/:type/:filename |

## 2) Frontend Tab to Endpoint Dependency Matrix

| Frontend Tab Component | API Modules Used | Backend Endpoints Hit | Backend Owner |
|---|---|---|---|
| frontend/src/components/tabs/OverviewTab.jsx | api/tasks, api/auth, api/hr, api/attendance, api/messages | /api/tasks*, /api/auth/users, /api/hr/employees*, /api/attendance/*, /api/messages/*, /api/realtime/events | tasks, auth, employees, attendance, messages, realtime |
| frontend/src/components/tabs/ChatTab.jsx | api/messages | /api/messages/latest, /api/messages, /api/realtime/events | messages, realtime |
| frontend/src/components/tabs/AdminTab.jsx | api/auth | /api/auth/users*, /api/auth/users/:id/role, /api/auth/users/:id/permissions, /api/auth/users/:id/toggle | auth |
| frontend/src/components/tabs/HRTab.jsx | api/hr | /api/hr/employees* | employees |
| frontend/src/components/tabs/SalesTab.jsx | api/crm | /api/crm/dashboard, /api/crm/contacts*, /api/crm/companies*, /api/crm/leads*, /api/crm/deals*, /api/crm/activities*, /api/crm/followups, /api/crm/templates/*, /api/crm/*/import, /api/crm/*/export | crm |
| frontend/src/components/tabs/OperationsTab.jsx | api/erp | Mainly /api/erp/inventory* in current implementation | erp |
| frontend/src/components/tabs/ProductionTab.jsx | api/erp | /api/erp/production/work-orders* | erp |
| frontend/src/components/tabs/FinanceTab.jsx | api/finance, api/erp-accounting | /api/finance/invoices*, /api/finance/expenses*, /api/finance/payroll*, /api/finance/budgets*, /api/finance/taxes*, and /api/erp-accounting/ledger | finance, erp-accounting |
| frontend/src/components/tabs/ComplianceTab.jsx | api/compliance | /api/compliance/eligibility*, /api/compliance/approvals*, /api/compliance/docs*, /api/compliance/updates*, /api/compliance/agreements* | compliance |
| frontend/src/components/tabs/TrainingTab.jsx | api/training | /api/training/sessions*, /api/training/batches*, /api/training/attendance*, /api/training/resources*, /api/training/assessments*, /api/training/certs*, /api/training/feedback*, /api/training/trainees* | training |
| frontend/src/components/tabs/ERPTab.jsx | api/erp-accounting, api/messages | /api/erp-accounting/accounts*, customers*, ledger*, mappings*, currencies*, report-branding, metal-rates, transactions*, reports/*, vendors*, inventory/*, direct-deals*, attachments/download/* and /api/messages/latest | erp-accounting, messages |
| frontend/src/components/tabs/VoucherTab.jsx | direct axios + /api/erp-accounting | /api/erp-accounting/transactions*, customers, vendors, currencies, metal-rates, inventory/products | erp-accounting |
| frontend/src/components/tabs/DirectDealsTab.jsx | api/erp-accounting | /api/erp-accounting/direct-deals* | erp-accounting |
| frontend/src/components/tabs/ChartOfAccountsTree.jsx | api/erp-accounting | /api/erp-accounting/accounts*, /api/erp-accounting/currencies, plus customer/vendor create calls | erp-accounting |

## 3) Method-Level Permission Matrix (Create, Update, Delete)

Legend:
- SA: super_admin
- MGMT: management
- DH: department_head
- DU: department_user
- EXT: external

| Route Group | Read (GET) | Create (POST) | Update (PUT/PATCH/POST workflow) | Delete (DELETE) |
|---|---|---|---|---|
| Auth users (/api/auth/users*) | SA only | SA only | SA only | SA only |
| Employees (/api/hr/employees*) | SA, MGMT, HR DH, scoped others | SA, HR DH | SA, HR DH (scoped checks) | SA, HR DH (scoped checks) |
| Tasks (/api/tasks*) | SA/MGMT full, DH dept, DU scoped, EXT allowed modules | Any non-read-only role (not MGMT/EXT) | SA full, DH same dept, DU assigned/creator; MGMT/EXT denied mutate | SA; DH same dept; DU creator only |
| Attendance (/api/attendance*) | Role-scoped by department/self | Most roles can submit records/leave with restrictions; MGMT blocked for leave submit | Leave decisions: super admin and department heads (including HR head) | No delete endpoint |
| Messages (/api/messages*) | Scoped by role and message scope; SA/MGMT broadest | Authenticated users | Not exposed | Not exposed |
| CRM (/api/crm*) | Authenticated, role-filtered by sales helpers | Sales roles (SA, Sales DH, Sales DU depending entity) | Sales roles; some endpoints tighter | SA only for core entity delete endpoints |
| ERP operational (/api/erp*) | Authenticated, endpoint-specific scope | Endpoint-specific: generally SA + owning dept heads/finance rules | Endpoint-specific by function (operations, finance, production, SA) | Endpoint-specific, stricter on destructive ops |
| Finance (/api/finance/*) | Any authenticated user | SA or DH in finance/hr | SA or DH in finance/hr | SA only |
| Compliance (/api/compliance/*) | Any authenticated user | SA or DH in government/compliance/finance | SA or DH in government/compliance/finance | SA only |
| Training (/api/training/*) | Any authenticated user | SA or any DH | SA or any DH | SA only |
| ERP Accounting Accounts (/api/erp-accounting/accounts*) | SA or Finance DH | SA or Finance DH | SA or Finance DH | SA or Finance DH; some hard-delete flows admin-gated |
| ERP Accounting Mappings (/api/erp-accounting/mappings*) | SA or Finance DH | SA or Finance DH | SA or Finance DH | SA or Finance DH |
| ERP Accounting Currencies/Branding/Metal Rates | SA or Finance DH (read) | SA or Finance DH | SA or Finance DH | SA or Finance DH |
| ERP Accounting Customers (/api/erp-accounting/customers*) | SA, Finance DH, Sales DH | SA, Finance DH, Sales DH | SA, Finance DH, Sales DH | SA, Finance DH, Sales DH |
| ERP Accounting Vendors (/api/erp-accounting/vendors*) | SA, Finance DH, Operations DH | SA or Finance DH | SA, Finance DH, Operations DH (workflow approvals have stricter finance/admin checks) | SA or Finance DH |
| ERP Accounting Inventory (/api/erp-accounting/inventory/*) | SA, Finance DH, Operations DH, Production DH | SA or Finance DH for product create; broader for stock movements via access helper | SA/Finance/Operations/Production access helper | Product delete requires SA or Finance; ledger clear is stricter |
| ERP Accounting Direct Deals (/api/erp-accounting/direct-deals*) | SA, Finance DH, Sales DH | SA, Finance DH, Sales DH | SA, Finance DH, Sales DH with lock rules on confirmed deals | SA, Finance DH, Sales DH with lock rules on confirmed deals |
| ERP Accounting Attachments download | Authenticated with additional reference access checks | Not exposed | Not exposed | Not exposed |

## 4) Endpoint-by-Endpoint Permission Matrix

Legend:
- SA: super_admin
- MGMT: management
- DH: department_head
- DU: department_user
- EXT: external

### Auth

| Method | Endpoint | Permission Summary |
|---|---|---|
| POST | /api/auth/setup | Public setup (initial bootstrap) |
| POST | /api/auth/login | Public login |
| GET | /api/auth/me | Authenticated |
| POST | /api/auth/logout | Authenticated |
| POST | /api/auth/refresh | Authenticated |
| GET | /api/auth/users | SA only |
| POST | /api/auth/users | SA only |
| PUT | /api/auth/users/:id/role | SA only |
| PUT | /api/auth/users/:id/permissions | SA only |
| PUT | /api/auth/users/:id/toggle | SA only |
| DELETE | /api/auth/users/:id | SA only |

### Employees

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/hr/employees | Authenticated, scoped by role/department |
| POST | /api/hr/employees | SA or HR DH |
| PUT | /api/hr/employees/:id | SA or HR DH with scope checks |
| DELETE | /api/hr/employees/:id | SA or HR DH with scope checks |

### Tasks

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/tasks | Authenticated, role-scoped visibility |
| POST | /api/tasks | Any non-read-only role (not MGMT/EXT) |
| PUT | /api/tasks/:id | SA; DH same dept; DU assigned/creator; MGMT/EXT denied |
| POST | /api/tasks/:id/comments | Can view task and not read-only role |
| DELETE | /api/tasks/:id | SA; DH same dept; DU creator only |

### Attendance

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/attendance/records | Authenticated, scoped by role |
| GET | /api/attendance/summary | Authenticated, scoped by role |
| GET | /api/attendance/me | Authenticated |
| POST | /api/attendance/records | Authenticated (role validations apply) |
| GET | /api/attendance/leave | Authenticated, scoped by role |
| POST | /api/attendance/leave | Authenticated except MGMT blocked |
| PUT | /api/attendance/leave/:id/decision | SA and DH workflow |

### Messages And Realtime

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/messages/latest | Authenticated, scope-filtered by role/message visibility |
| POST | /api/messages | Authenticated |
| GET | /api/realtime/events | Authenticated |

### Department State

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/department-state/:module | Authenticated |
| PUT | /api/department-state/:module | Authenticated |

### CRM

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/crm/dashboard | salesOnly helper (sales role set) |
| GET | /api/crm/templates/contacts | salesOnly |
| GET | /api/crm/templates/companies | salesOnly |
| GET | /api/crm/templates/deals | salesOnly |
| GET | /api/crm/contacts/export | salesOnly |
| POST | /api/crm/contacts/import | salesOnly |
| GET | /api/crm/contacts | salesOnly |
| POST | /api/crm/contacts | salesOnly |
| PUT | /api/crm/contacts/:id | salesOnly |
| DELETE | /api/crm/contacts/:id | SA only |
| POST | /api/crm/contacts/:id/notes | salesOnly |
| POST | /api/crm/contacts/:id/documents | salesOnly |
| DELETE | /api/crm/contacts/:id/documents/:docId | salesOnly |
| GET | /api/crm/companies/export | salesOnly |
| POST | /api/crm/companies/import | salesOnly |
| GET | /api/crm/companies | salesOnly |
| POST | /api/crm/companies | salesOnly |
| PUT | /api/crm/companies/:id | salesOnly |
| DELETE | /api/crm/companies/:id | SA only |
| GET | /api/crm/leads | salesOnly |
| POST | /api/crm/leads | salesOnly |
| PUT | /api/crm/leads/:id | salesOnly |
| POST | /api/crm/leads/:id/stage | salesOnly |
| DELETE | /api/crm/leads/:id | SA only |
| GET | /api/crm/deals/export | salesOnly |
| POST | /api/crm/deals/import | salesOnly |
| GET | /api/crm/deals | salesOnly |
| POST | /api/crm/deals | salesOnly |
| PUT | /api/crm/deals/:id | salesOnly |
| POST | /api/crm/deals/:id/close | salesOnly |
| DELETE | /api/crm/deals/:id | SA only |
| GET | /api/crm/activities | salesOnly |
| POST | /api/crm/activities | salesOnly |
| PUT | /api/crm/activities/:id | salesOnly |
| DELETE | /api/crm/activities/:id | salesOnly |
| PATCH | /api/crm/activities/:id/followup-done | salesOnly |
| GET | /api/crm/followups | salesOnly |

### ERP Operational

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/erp/inventory | Authenticated; cost visibility scoped by helper |
| POST | /api/erp/inventory | Scoped create rules in route helper |
| PUT | /api/erp/inventory/:id | Scoped update rules |
| DELETE | /api/erp/inventory/:id | Scoped delete rules |
| GET | /api/erp/inventory/movements | Authenticated |
| GET | /api/erp/procurement/suppliers | Authenticated |
| POST | /api/erp/procurement/suppliers | Scoped write rules |
| PUT | /api/erp/procurement/suppliers/:id | Scoped write rules |
| DELETE | /api/erp/procurement/suppliers/:id | Scoped delete rules |
| GET | /api/erp/procurement/purchase-orders | Authenticated |
| POST | /api/erp/procurement/purchase-orders | canCreatePO helper |
| PUT | /api/erp/procurement/purchase-orders/:id | Scoped PO workflow rules |
| DELETE | /api/erp/procurement/purchase-orders/:id | canCreatePO helper |
| GET | /api/erp/production/work-orders | Authenticated |
| POST | /api/erp/production/work-orders | Scoped production write rules |
| PUT | /api/erp/production/work-orders/:id | Scoped production write rules |
| DELETE | /api/erp/production/work-orders/:id | Scoped production delete rules |
| GET | /api/erp/finance/records | Authenticated |
| POST | /api/erp/finance/records | Scoped finance write rules |
| PUT | /api/erp/finance/records/:id | Scoped finance write rules |
| DELETE | /api/erp/finance/records/:id | Scoped finance delete rules |
| GET | /api/erp/procurement/documents | Authenticated |
| POST | /api/erp/procurement/documents | canUploadProcDocs helper |
| DELETE | /api/erp/procurement/documents/:id | Scoped delete rules |
| GET | /api/erp/alerts/expiry | Authenticated |
| PUT | /api/erp/alerts/expiry/:id/resolve | Scoped write rules |

### Finance

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/finance/invoices | Authenticated |
| POST | /api/finance/invoices | SA or finance/hr DH |
| PUT | /api/finance/invoices/:id | SA or finance/hr DH |
| DELETE | /api/finance/invoices/:id | SA only |
| GET | /api/finance/expenses | Authenticated |
| POST | /api/finance/expenses | SA or finance/hr DH |
| PUT | /api/finance/expenses/:id | SA or finance/hr DH |
| DELETE | /api/finance/expenses/:id | SA only |
| GET | /api/finance/payroll | Authenticated |
| POST | /api/finance/payroll | SA or finance/hr DH |
| PUT | /api/finance/payroll/:id | SA or finance/hr DH |
| DELETE | /api/finance/payroll/:id | SA only |
| GET | /api/finance/budgets | Authenticated |
| POST | /api/finance/budgets | SA or finance/hr DH |
| PUT | /api/finance/budgets/:id | SA or finance/hr DH |
| DELETE | /api/finance/budgets/:id | SA only |
| GET | /api/finance/taxes | Authenticated |
| POST | /api/finance/taxes | SA or finance/hr DH |
| PUT | /api/finance/taxes/:id | SA or finance/hr DH |
| DELETE | /api/finance/taxes/:id | SA only |

### Compliance

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/compliance/eligibility | Authenticated |
| POST | /api/compliance/eligibility | SA or government/compliance/finance DH |
| PUT | /api/compliance/eligibility/:id | SA or government/compliance/finance DH |
| DELETE | /api/compliance/eligibility/:id | SA only |
| GET | /api/compliance/approvals | Authenticated |
| POST | /api/compliance/approvals | SA or government/compliance/finance DH |
| PUT | /api/compliance/approvals/:id | SA or government/compliance/finance DH |
| DELETE | /api/compliance/approvals/:id | SA only |
| GET | /api/compliance/docs | Authenticated |
| POST | /api/compliance/docs | SA or government/compliance/finance DH |
| PUT | /api/compliance/docs/:id | SA or government/compliance/finance DH |
| DELETE | /api/compliance/docs/:id | SA only |
| GET | /api/compliance/updates | Authenticated |
| POST | /api/compliance/updates | SA or government/compliance/finance DH |
| PUT | /api/compliance/updates/:id | SA or government/compliance/finance DH |
| DELETE | /api/compliance/updates/:id | SA only |
| GET | /api/compliance/agreements | Authenticated |
| POST | /api/compliance/agreements | SA or government/compliance/finance DH |
| PUT | /api/compliance/agreements/:id | SA or government/compliance/finance DH |
| DELETE | /api/compliance/agreements/:id | SA only |

### Training

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/training/sessions | Authenticated |
| POST | /api/training/sessions | SA or any DH |
| PUT | /api/training/sessions/:id | SA or any DH |
| DELETE | /api/training/sessions/:id | SA only |
| GET | /api/training/batches | Authenticated |
| POST | /api/training/batches | SA or any DH |
| PUT | /api/training/batches/:id | SA or any DH |
| DELETE | /api/training/batches/:id | SA only |
| GET | /api/training/attendance | Authenticated |
| POST | /api/training/attendance | SA or any DH |
| PUT | /api/training/attendance/:id | SA or any DH |
| DELETE | /api/training/attendance/:id | SA only |
| GET | /api/training/resources | Authenticated |
| POST | /api/training/resources | SA or any DH |
| PUT | /api/training/resources/:id | SA or any DH |
| DELETE | /api/training/resources/:id | SA only |
| GET | /api/training/assessments | Authenticated |
| POST | /api/training/assessments | SA or any DH |
| PUT | /api/training/assessments/:id | SA or any DH |
| DELETE | /api/training/assessments/:id | SA only |
| GET | /api/training/certs | Authenticated |
| POST | /api/training/certs | SA or any DH |
| PUT | /api/training/certs/:id | SA or any DH |
| DELETE | /api/training/certs/:id | SA only |
| GET | /api/training/feedback | Authenticated |
| POST | /api/training/feedback | SA or any DH |
| PUT | /api/training/feedback/:id | SA or any DH |
| DELETE | /api/training/feedback/:id | SA only |
| GET | /api/training/trainees | Authenticated |
| POST | /api/training/trainees | SA or any DH |
| PUT | /api/training/trainees/:id | SA or any DH |
| DELETE | /api/training/trainees/:id | SA only |

### ERP Accounting

| Method | Endpoint | Permission Summary |
|---|---|---|
| GET | /api/erp-accounting/accounts | SA or Finance DH |
| GET | /api/erp-accounting/accounts/enquiry | SA, Finance DH, Department Head summary access |
| GET | /api/erp-accounting/accounts/:id | SA or Finance DH |
| POST | /api/erp-accounting/accounts | SA or Finance DH |
| POST | /api/erp-accounting/accounts/bulk-seed | SA only |
| PUT | /api/erp-accounting/accounts/:id | SA or Finance DH |
| DELETE | /api/erp-accounting/accounts/:id | SA or Finance DH |
| POST | /api/erp-accounting/accounts/hard-delete-by-code | SA only |
| GET | /api/erp-accounting/ledger | SA or Finance DH |
| POST | /api/erp-accounting/ledger | SA or Finance DH |
| PUT | /api/erp-accounting/ledger/:id | SA or Finance DH |
| DELETE | /api/erp-accounting/ledger/:id | SA or Finance DH |
| DELETE | /api/erp-accounting/ledger/:id/permanent | SA only |
| PUT | /api/erp-accounting/ledger/:id/reconcile | SA or Finance DH |
| GET | /api/erp-accounting/mappings | SA or Finance DH |
| POST | /api/erp-accounting/mappings | SA or Finance DH |
| PUT | /api/erp-accounting/mappings/:id | SA or Finance DH |
| DELETE | /api/erp-accounting/mappings/:id | SA or Finance DH |
| GET | /api/erp-accounting/currencies | SA or Finance DH |
| POST | /api/erp-accounting/currencies/seed-defaults | SA or Finance DH |
| GET | /api/erp-accounting/report-branding | SA or Finance DH |
| PUT | /api/erp-accounting/report-branding | SA or Finance DH |
| GET | /api/erp-accounting/metal-rates | SA or Finance DH |
| PUT | /api/erp-accounting/metal-rates | SA or Finance DH |
| POST | /api/erp-accounting/currencies | SA or Finance DH |
| PUT | /api/erp-accounting/currencies/:id | SA or Finance DH |
| DELETE | /api/erp-accounting/currencies/:id | SA or Finance DH |
| GET | /api/erp-accounting/customers | SA, Finance DH, Sales DH |
| GET | /api/erp-accounting/customers/:id/aging | SA, Finance DH, Sales DH |
| POST | /api/erp-accounting/customers | SA, Finance DH, Sales DH |
| PUT | /api/erp-accounting/customers/:id | SA, Finance DH, Sales DH |
| DELETE | /api/erp-accounting/customers/:id | SA, Finance DH, Sales DH |
| GET | /api/erp-accounting/vendors | SA, Finance DH, Operations DH |
| GET | /api/erp-accounting/vendors/compliance-summary | SA, Finance DH, Operations DH |
| GET | /api/erp-accounting/vendors/alerts/overdue-queue | SA, Finance DH, Operations DH |
| POST | /api/erp-accounting/vendors | SA or Finance DH |
| PUT | /api/erp-accounting/vendors/:id | SA, Finance DH, Operations DH |
| GET | /api/erp-accounting/vendors/:id/details | SA, Finance DH, Operations DH |
| POST | /api/erp-accounting/vendors/:id/workflow | SA, Finance DH, Operations DH (approval/blacklist stricter finance/admin) |
| GET | /api/erp-accounting/vendors/:id/documents | SA, Finance DH, Operations DH |
| POST | /api/erp-accounting/vendors/:id/documents | SA, Finance DH, Operations DH |
| PUT | /api/erp-accounting/vendors/:id/documents/:documentId | SA, Finance DH, Operations DH |
| DELETE | /api/erp-accounting/vendors/:id/documents/:documentId | SA, Finance DH, Operations DH |
| GET | /api/erp-accounting/vendors/payment-calendar | SA, Finance DH, Operations DH |
| DELETE | /api/erp-accounting/vendors/:id | SA or Finance DH |
| GET | /api/erp-accounting/inventory/products | SA, Finance DH, Operations DH, Production DH |
| POST | /api/erp-accounting/inventory/products | SA or Finance DH |
| POST | /api/erp-accounting/inventory/stock-in | SA, Finance DH, Operations DH, Production DH |
| POST | /api/erp-accounting/inventory/stock-out | SA, Finance DH, Operations DH, Production DH |
| PUT | /api/erp-accounting/inventory/products/:id | SA, Finance DH, Operations DH, Production DH |
| DELETE | /api/erp-accounting/inventory/products/:id | SA or Finance DH |
| GET | /api/erp-accounting/inventory/stock-ledger | SA, Finance DH, Operations DH, Production DH |
| DELETE | /api/erp-accounting/inventory/stock-ledger | SA only |
| GET | /api/erp-accounting/direct-deals | SA, Finance DH, Sales DH |
| POST | /api/erp-accounting/direct-deals | SA, Finance DH, Sales DH |
| PUT | /api/erp-accounting/direct-deals/:id | SA, Finance DH, Sales DH (confirmed lock rules apply) |
| DELETE | /api/erp-accounting/direct-deals/:id | SA, Finance DH, Sales DH (confirmed lock rules apply) |
| GET | /api/erp-accounting/reports/trial-balance | SA or Finance DH |
| GET | /api/erp-accounting/reports/ledger | SA or Finance DH |
| GET | /api/erp-accounting/reports/profit-loss | SA or Finance DH |
| GET | /api/erp-accounting/reports/balance-sheet | SA or Finance DH |
| GET | /api/erp-accounting/reports/day-book | SA or Finance DH |
| GET | /api/erp-accounting/reports/customer-outstanding | SA or Finance DH |
| GET | /api/erp-accounting/reports/vendor-outstanding | SA or Finance DH |
| GET | /api/erp-accounting/reports/forex-gain-loss | SA or Finance DH |
| GET | /api/erp-accounting/reports/dashboard | SA or Finance DH |
| GET | /api/erp-accounting/transactions | Transaction access helper (finance/admin scoped) |
| POST | /api/erp-accounting/transactions | Transaction create helper |
| PUT | /api/erp-accounting/transactions/:id | Transaction manage helper |
| POST | /api/erp-accounting/transactions/:id/void | Transaction manage helper |
| DELETE | /api/erp-accounting/transactions/:id | Transaction manage helper |
| POST | /api/erp-accounting/transactions/:id/submit | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/:id/approve | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/:id/post | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/:id/revalue-fx-journal | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/:id/comments | Transaction access helper |
| POST | /api/erp-accounting/transactions/:id/attachments | Transaction access helper |
| DELETE | /api/erp-accounting/transactions/:id/attachments/:attachmentId | Transaction manage helper |
| POST | /api/erp-accounting/transactions/:id/return | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/:id/reject | Transaction workflow helper |
| POST | /api/erp-accounting/transactions/bulk-action | Transaction manage helper |
| GET | /api/erp-accounting/transactions/source-by-ledger/:ledgerId | Transaction access helper |
| GET | /api/erp-accounting/attachments/download/:type/:filename | Authenticated + record-level access checks |

## 5) Permission Rule References

- Auth restrictions: backend/routes/auth.js
- Employees scoping: backend/routes/employees.js
- Task role model: backend/routes/tasks.js
- Attendance role checks: backend/routes/attendance.js
- CRM role helpers and delete guard: backend/routes/crm.js
- ERP role helpers and per-endpoint checks: backend/routes/erp.js
- Finance/Compliance/Training CRUD policy pattern: backend/routes/finance.js, backend/routes/compliance.js, backend/routes/training.js
- ERP accounting shared permission helpers: backend/routes/erp-accounting.js
- ERP accounting route-level guards: backend/routes/erp-accounting/*.js

## 6) Notes

- This matrix reflects current code behavior, not aspirational policy.
- Entries marked endpoint-specific indicate mixed rules inside the same route file.
- Operations tab currently persists mostly inventory API operations; many operations sections are still local UI state.
