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

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| POST | /api/auth/setup | Public setup (initial bootstrap) | public handler |
| POST | /api/auth/login | Public login | public handler |
| GET | /api/auth/me | Authenticated | protect |
| POST | /api/auth/logout | Authenticated | protect |
| POST | /api/auth/refresh | Authenticated | protect |
| GET | /api/auth/users | SA only | protect + restrictTo('super_admin') |
| POST | /api/auth/users | SA only | protect + restrictTo('super_admin') |
| PUT | /api/auth/users/:id/role | SA only | protect + restrictTo('super_admin') |
| PUT | /api/auth/users/:id/permissions | SA only | protect + restrictTo('super_admin') |
| PUT | /api/auth/users/:id/toggle | SA only | protect + restrictTo('super_admin') |
| DELETE | /api/auth/users/:id | SA only | protect + restrictTo('super_admin') |

### Employees

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/hr/employees | Authenticated, scoped by role/department | protect + buildEmployeeReadFilter |
| POST | /api/hr/employees | SA or HR DH | protect + canManageEmployees |
| PUT | /api/hr/employees/:id | SA or HR DH with scope checks | protect + canManageEmployees |
| DELETE | /api/hr/employees/:id | SA or HR DH with scope checks | protect + canManageEmployees |

### Tasks

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/tasks | Authenticated, role-scoped visibility | protect + buildTaskReadFilter |
| POST | /api/tasks | Any non-read-only role (not MGMT/EXT) | protect + canCreateTask |
| PUT | /api/tasks/:id | SA; DH same dept; DU assigned/creator; MGMT/EXT denied | protect + canViewTask + canMutateTask |
| POST | /api/tasks/:id/comments | Can view task and not read-only role | protect + canViewTask + isReadOnlyRole |
| DELETE | /api/tasks/:id | SA; DH same dept; DU creator only | protect + canDeleteTask |

### Attendance

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/attendance/records | Authenticated, scoped by role | protect + role/dept scoping |
| GET | /api/attendance/summary | Authenticated, scoped by role | protect + role/dept scoping |
| GET | /api/attendance/me | Authenticated | protect + role/dept scoping |
| POST | /api/attendance/records | Authenticated (role validations apply) | protect + canManageAttendance/canTouchDepartment |
| GET | /api/attendance/leave | Authenticated, scoped by role | protect + role/dept scoping |
| POST | /api/attendance/leave | Authenticated except MGMT blocked | protect + role checks + canTouchDepartment |
| PUT | /api/attendance/leave/:id/decision | SA and DH workflow | protect + canReviewLeave |

### Messages And Realtime

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/messages/latest | Authenticated, scope-filtered by role/message visibility | protect + buildMessageScope |
| POST | /api/messages | Authenticated | protect + buildMessageScope |
| GET | /api/realtime/events | Authenticated | protect (SSE stream) |

### Department State

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/department-state/:module | Authenticated | protect |
| PUT | /api/department-state/:module | Authenticated | protect |

### CRM

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/crm/dashboard | salesOnly helper (sales role set) | salesOnly |
| GET | /api/crm/templates/contacts | salesOnly | salesOnly |
| GET | /api/crm/templates/companies | salesOnly | salesOnly |
| GET | /api/crm/templates/deals | salesOnly | salesOnly |
| GET | /api/crm/contacts/export | salesOnly | salesOnly |
| POST | /api/crm/contacts/import | salesOnly | salesOnly |
| GET | /api/crm/contacts | salesOnly | salesOnly |
| POST | /api/crm/contacts | salesOnly | salesOnly |
| PUT | /api/crm/contacts/:id | salesOnly | salesOnly |
| DELETE | /api/crm/contacts/:id | SA only | salesOnly + canDelete |
| POST | /api/crm/contacts/:id/notes | salesOnly | salesOnly |
| POST | /api/crm/contacts/:id/documents | salesOnly | salesOnly |
| DELETE | /api/crm/contacts/:id/documents/:docId | salesOnly | salesOnly |
| GET | /api/crm/companies/export | salesOnly | salesOnly |
| POST | /api/crm/companies/import | salesOnly | salesOnly |
| GET | /api/crm/companies | salesOnly | salesOnly |
| POST | /api/crm/companies | salesOnly | salesOnly |
| PUT | /api/crm/companies/:id | salesOnly | salesOnly |
| DELETE | /api/crm/companies/:id | SA only | salesOnly + canDelete |
| GET | /api/crm/leads | salesOnly | salesOnly |
| POST | /api/crm/leads | salesOnly | salesOnly |
| PUT | /api/crm/leads/:id | salesOnly | salesOnly |
| POST | /api/crm/leads/:id/stage | salesOnly | salesOnly |
| DELETE | /api/crm/leads/:id | SA only | salesOnly + canDelete |
| GET | /api/crm/deals/export | salesOnly | salesOnly |
| POST | /api/crm/deals/import | salesOnly | salesOnly |
| GET | /api/crm/deals | salesOnly | salesOnly |
| POST | /api/crm/deals | salesOnly | salesOnly |
| PUT | /api/crm/deals/:id | salesOnly | salesOnly |
| POST | /api/crm/deals/:id/close | salesOnly | salesOnly |
| DELETE | /api/crm/deals/:id | SA only | salesOnly + canDelete |
| GET | /api/crm/activities | salesOnly | salesOnly |
| POST | /api/crm/activities | salesOnly | salesOnly |
| PUT | /api/crm/activities/:id | salesOnly | salesOnly |
| DELETE | /api/crm/activities/:id | salesOnly | salesOnly |
| PATCH | /api/crm/activities/:id/followup-done | salesOnly | salesOnly |
| GET | /api/crm/followups | salesOnly | salesOnly |

### ERP Operational

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/erp/inventory | Authenticated; cost visibility scoped by helper | protect + canViewInventoryCosts |
| POST | /api/erp/inventory | Scoped create rules in route helper | protect + canEditInventory |
| PUT | /api/erp/inventory/:id | Scoped update rules | protect + canEditInventory |
| DELETE | /api/erp/inventory/:id | Scoped delete rules | protect + canEditInventory |
| GET | /api/erp/inventory/movements | Authenticated | protect + canViewInventoryCosts |
| GET | /api/erp/procurement/suppliers | Authenticated | protect + canManageSuppliers |
| POST | /api/erp/procurement/suppliers | Scoped write rules | protect + canManageSuppliers |
| PUT | /api/erp/procurement/suppliers/:id | Scoped write rules | protect + canManageSuppliers |
| DELETE | /api/erp/procurement/suppliers/:id | Scoped delete rules | protect + canManageSuppliers |
| GET | /api/erp/procurement/purchase-orders | Authenticated | protect + route-specific helper |
| POST | /api/erp/procurement/purchase-orders | canCreatePO helper | protect + canCreatePO |
| PUT | /api/erp/procurement/purchase-orders/:id | Scoped PO workflow rules | protect + canCreatePO/canApprovePOBudget |
| DELETE | /api/erp/procurement/purchase-orders/:id | canCreatePO helper | protect + canCreatePO |
| GET | /api/erp/production/work-orders | Authenticated | protect + canManageProduction |
| POST | /api/erp/production/work-orders | Scoped production write rules | protect + canManageProduction |
| PUT | /api/erp/production/work-orders/:id | Scoped production write rules | protect + canManageProduction |
| DELETE | /api/erp/production/work-orders/:id | Scoped production delete rules | protect + canManageProduction |
| GET | /api/erp/finance/records | Authenticated | protect + canManageFinance |
| POST | /api/erp/finance/records | Scoped finance write rules | protect + canManageFinance |
| PUT | /api/erp/finance/records/:id | Scoped finance write rules | protect + canManageFinance |
| DELETE | /api/erp/finance/records/:id | Scoped finance delete rules | protect + canManageFinance |
| GET | /api/erp/procurement/documents | Authenticated | protect + canUploadProcDocs/canCreatePO |
| POST | /api/erp/procurement/documents | canUploadProcDocs helper | protect + canUploadProcDocs |
| DELETE | /api/erp/procurement/documents/:id | Scoped delete rules | protect + canUploadProcDocs/canCreatePO |
| GET | /api/erp/alerts/expiry | Authenticated | protect + canManageSuppliers |
| PUT | /api/erp/alerts/expiry/:id/resolve | Scoped write rules | protect + canManageSuppliers |

### Finance

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/finance/invoices | Authenticated | protect |
| POST | /api/finance/invoices | SA or finance/hr DH | protect + canWrite |
| PUT | /api/finance/invoices/:id | SA or finance/hr DH | protect + canWrite |
| DELETE | /api/finance/invoices/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/finance/expenses | Authenticated | protect |
| POST | /api/finance/expenses | SA or finance/hr DH | protect + canWrite |
| PUT | /api/finance/expenses/:id | SA or finance/hr DH | protect + canWrite |
| DELETE | /api/finance/expenses/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/finance/payroll | Authenticated | protect |
| POST | /api/finance/payroll | SA or finance/hr DH | protect + canWrite |
| PUT | /api/finance/payroll/:id | SA or finance/hr DH | protect + canWrite |
| DELETE | /api/finance/payroll/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/finance/budgets | Authenticated | protect |
| POST | /api/finance/budgets | SA or finance/hr DH | protect + canWrite |
| PUT | /api/finance/budgets/:id | SA or finance/hr DH | protect + canWrite |
| DELETE | /api/finance/budgets/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/finance/taxes | Authenticated | protect |
| POST | /api/finance/taxes | SA or finance/hr DH | protect + canWrite |
| PUT | /api/finance/taxes/:id | SA or finance/hr DH | protect + canWrite |
| DELETE | /api/finance/taxes/:id | SA only | protect + req.user.role==='super_admin' |

### Compliance

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/compliance/eligibility | Authenticated | protect |
| POST | /api/compliance/eligibility | SA or government/compliance/finance DH | protect + canWrite |
| PUT | /api/compliance/eligibility/:id | SA or government/compliance/finance DH | protect + canWrite |
| DELETE | /api/compliance/eligibility/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/compliance/approvals | Authenticated | protect |
| POST | /api/compliance/approvals | SA or government/compliance/finance DH | protect + canWrite |
| PUT | /api/compliance/approvals/:id | SA or government/compliance/finance DH | protect + canWrite |
| DELETE | /api/compliance/approvals/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/compliance/docs | Authenticated | protect |
| POST | /api/compliance/docs | SA or government/compliance/finance DH | protect + canWrite |
| PUT | /api/compliance/docs/:id | SA or government/compliance/finance DH | protect + canWrite |
| DELETE | /api/compliance/docs/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/compliance/updates | Authenticated | protect |
| POST | /api/compliance/updates | SA or government/compliance/finance DH | protect + canWrite |
| PUT | /api/compliance/updates/:id | SA or government/compliance/finance DH | protect + canWrite |
| DELETE | /api/compliance/updates/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/compliance/agreements | Authenticated | protect |
| POST | /api/compliance/agreements | SA or government/compliance/finance DH | protect + canWrite |
| PUT | /api/compliance/agreements/:id | SA or government/compliance/finance DH | protect + canWrite |
| DELETE | /api/compliance/agreements/:id | SA only | protect + req.user.role==='super_admin' |

### Training

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/training/sessions | Authenticated | protect |
| POST | /api/training/sessions | SA or any DH | protect + canWrite |
| PUT | /api/training/sessions/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/sessions/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/batches | Authenticated | protect |
| POST | /api/training/batches | SA or any DH | protect + canWrite |
| PUT | /api/training/batches/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/batches/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/attendance | Authenticated | protect |
| POST | /api/training/attendance | SA or any DH | protect + canWrite |
| PUT | /api/training/attendance/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/attendance/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/resources | Authenticated | protect |
| POST | /api/training/resources | SA or any DH | protect + canWrite |
| PUT | /api/training/resources/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/resources/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/assessments | Authenticated | protect |
| POST | /api/training/assessments | SA or any DH | protect + canWrite |
| PUT | /api/training/assessments/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/assessments/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/certs | Authenticated | protect |
| POST | /api/training/certs | SA or any DH | protect + canWrite |
| PUT | /api/training/certs/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/certs/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/feedback | Authenticated | protect |
| POST | /api/training/feedback | SA or any DH | protect + canWrite |
| PUT | /api/training/feedback/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/feedback/:id | SA only | protect + req.user.role==='super_admin' |
| GET | /api/training/trainees | Authenticated | protect |
| POST | /api/training/trainees | SA or any DH | protect + canWrite |
| PUT | /api/training/trainees/:id | SA or any DH | protect + canWrite |
| DELETE | /api/training/trainees/:id | SA only | protect + req.user.role==='super_admin' |

### ERP Accounting

| Method | Endpoint | Permission Summary | Enforcing Helper(s) |
|---|---|---|---|
| GET | /api/erp-accounting/accounts | SA or Finance DH | protect + canViewAccounts |
| GET | /api/erp-accounting/accounts/enquiry | SA, Finance DH, Department Head summary access | protect + canViewAccountSummary |
| GET | /api/erp-accounting/accounts/:id | SA or Finance DH | protect + canViewAccounts |
| POST | /api/erp-accounting/accounts | SA or Finance DH | protect + canManageAccounts |
| POST | /api/erp-accounting/accounts/bulk-seed | SA only | protect + isSuperAdmin |
| PUT | /api/erp-accounting/accounts/:id | SA or Finance DH | protect + canManageAccounts |
| DELETE | /api/erp-accounting/accounts/:id | SA or Finance DH | protect + canManageAccounts |
| POST | /api/erp-accounting/accounts/hard-delete-by-code | SA only | protect + isSuperAdmin |
| GET | /api/erp-accounting/ledger | SA or Finance DH | protect + canViewLedger |
| POST | /api/erp-accounting/ledger | SA or Finance DH | protect + canManageAccounts |
| PUT | /api/erp-accounting/ledger/:id | SA or Finance DH | protect + canManageAccounts |
| DELETE | /api/erp-accounting/ledger/:id | SA or Finance DH | protect + canManageAccounts |
| DELETE | /api/erp-accounting/ledger/:id/permanent | SA only | protect + isSuperAdmin |
| PUT | /api/erp-accounting/ledger/:id/reconcile | SA or Finance DH | protect + canManageAccounts |
| GET | /api/erp-accounting/mappings | SA or Finance DH | protect + canViewMappings |
| POST | /api/erp-accounting/mappings | SA or Finance DH | protect + canManageMappings |
| PUT | /api/erp-accounting/mappings/:id | SA or Finance DH | protect + canManageMappings |
| DELETE | /api/erp-accounting/mappings/:id | SA or Finance DH | protect + canManageMappings |
| GET | /api/erp-accounting/currencies | SA or Finance DH | protect + canViewAccounts |
| POST | /api/erp-accounting/currencies/seed-defaults | SA or Finance DH | protect + canManageAccounts |
| GET | /api/erp-accounting/report-branding | SA or Finance DH | protect + canViewAccounts |
| PUT | /api/erp-accounting/report-branding | SA or Finance DH | protect + canManageAccounts |
| GET | /api/erp-accounting/metal-rates | SA or Finance DH | protect + canViewAccounts |
| PUT | /api/erp-accounting/metal-rates | SA or Finance DH | protect + canManageAccounts |
| POST | /api/erp-accounting/currencies | SA or Finance DH | protect + canManageAccounts |
| PUT | /api/erp-accounting/currencies/:id | SA or Finance DH | protect + canManageAccounts |
| DELETE | /api/erp-accounting/currencies/:id | SA or Finance DH | protect + canManageAccounts |
| GET | /api/erp-accounting/customers | SA, Finance DH, Sales DH | protect + canViewCustomers |
| GET | /api/erp-accounting/customers/:id/aging | SA, Finance DH, Sales DH | protect + canViewCustomers |
| POST | /api/erp-accounting/customers | SA, Finance DH, Sales DH | protect + canManageCustomers |
| PUT | /api/erp-accounting/customers/:id | SA, Finance DH, Sales DH | protect + canManageCustomers |
| DELETE | /api/erp-accounting/customers/:id | SA, Finance DH, Sales DH | protect + canManageCustomers |
| GET | /api/erp-accounting/vendors | SA, Finance DH, Operations DH | protect + canAccessVendors |
| GET | /api/erp-accounting/vendors/compliance-summary | SA, Finance DH, Operations DH | protect + canAccessVendors |
| GET | /api/erp-accounting/vendors/alerts/overdue-queue | SA, Finance DH, Operations DH | protect + canAccessVendors |
| POST | /api/erp-accounting/vendors | SA or Finance DH | protect + isSuperAdmin/isFinance |
| PUT | /api/erp-accounting/vendors/:id | SA, Finance DH, Operations DH | protect + canUpdateVendorOperational |
| GET | /api/erp-accounting/vendors/:id/details | SA, Finance DH, Operations DH | protect + canAccessVendors |
| POST | /api/erp-accounting/vendors/:id/workflow | SA, Finance DH, Operations DH (approval/blacklist stricter finance/admin) | protect + canUpdateVendorOperational |
| GET | /api/erp-accounting/vendors/:id/documents | SA, Finance DH, Operations DH | protect + canAccessVendors |
| POST | /api/erp-accounting/vendors/:id/documents | SA, Finance DH, Operations DH | protect + canUpdateVendorOperational |
| PUT | /api/erp-accounting/vendors/:id/documents/:documentId | SA, Finance DH, Operations DH | protect + canUpdateVendorOperational |
| DELETE | /api/erp-accounting/vendors/:id/documents/:documentId | SA, Finance DH, Operations DH | protect + canUpdateVendorOperational |
| GET | /api/erp-accounting/vendors/payment-calendar | SA, Finance DH, Operations DH | protect + canAccessVendors |
| DELETE | /api/erp-accounting/vendors/:id | SA or Finance DH | protect + isSuperAdmin/isFinance |
| GET | /api/erp-accounting/inventory/products | SA, Finance DH, Operations DH, Production DH | protect + canAccessInventory |
| POST | /api/erp-accounting/inventory/products | SA or Finance DH | protect + canAccessInventory |
| POST | /api/erp-accounting/inventory/stock-in | SA, Finance DH, Operations DH, Production DH | protect + canAccessInventory |
| POST | /api/erp-accounting/inventory/stock-out | SA, Finance DH, Operations DH, Production DH | protect + canAccessInventory |
| PUT | /api/erp-accounting/inventory/products/:id | SA, Finance DH, Operations DH, Production DH | protect + canAccessInventory |
| DELETE | /api/erp-accounting/inventory/products/:id | SA or Finance DH | protect + isSuperAdmin/isFinance |
| GET | /api/erp-accounting/inventory/stock-ledger | SA, Finance DH, Operations DH, Production DH | protect + canAccessInventory |
| DELETE | /api/erp-accounting/inventory/stock-ledger | SA only | protect + isSuperAdmin |
| GET | /api/erp-accounting/direct-deals | SA, Finance DH, Sales DH | protect + canAccessDirectDeals |
| POST | /api/erp-accounting/direct-deals | SA, Finance DH, Sales DH | protect + canManageDirectDeals |
| PUT | /api/erp-accounting/direct-deals/:id | SA, Finance DH, Sales DH (confirmed lock rules apply) | protect + canManageDirectDeals |
| DELETE | /api/erp-accounting/direct-deals/:id | SA, Finance DH, Sales DH (confirmed lock rules apply) | protect + canManageDirectDeals |
| GET | /api/erp-accounting/reports/trial-balance | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/ledger | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/profit-loss | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/balance-sheet | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/day-book | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/customer-outstanding | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/vendor-outstanding | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/forex-gain-loss | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/reports/dashboard | SA or Finance DH | protect + canAccessReports |
| GET | /api/erp-accounting/transactions | Transaction access helper (finance/admin scoped) | protect + canAccessTransactions |
| POST | /api/erp-accounting/transactions | Transaction create helper | protect + canCreateTransactionFor |
| PUT | /api/erp-accounting/transactions/:id | Transaction manage helper | protect + canCreateTransactionFor |
| POST | /api/erp-accounting/transactions/:id/void | Transaction manage helper | protect + canCreateTransactionFor |
| DELETE | /api/erp-accounting/transactions/:id | Transaction manage helper | protect + canCreateTransactionFor |
| POST | /api/erp-accounting/transactions/:id/submit | Transaction workflow helper | protect + applyTransactionWorkflowAction |
| POST | /api/erp-accounting/transactions/:id/approve | Transaction workflow helper | protect + applyTransactionWorkflowAction |
| POST | /api/erp-accounting/transactions/:id/post | Transaction workflow helper | protect + applyTransactionWorkflowAction |
| POST | /api/erp-accounting/transactions/:id/revalue-fx-journal | Transaction workflow helper | protect + build/applyFxJournalRevaluation |
| POST | /api/erp-accounting/transactions/:id/comments | Transaction access helper | protect + canAccessTransactions + appendTransactionComment |
| POST | /api/erp-accounting/transactions/:id/attachments | Transaction access helper | protect + validateAttachmentContent |
| DELETE | /api/erp-accounting/transactions/:id/attachments/:attachmentId | Transaction manage helper | protect + canCreateTransactionFor |
| POST | /api/erp-accounting/transactions/:id/return | Transaction workflow helper | protect + applyTransactionWorkflowAction |
| POST | /api/erp-accounting/transactions/:id/reject | Transaction workflow helper | protect + applyTransactionWorkflowAction |
| POST | /api/erp-accounting/transactions/bulk-action | Transaction manage helper | protect + canCreateTransactionFor |
| GET | /api/erp-accounting/transactions/source-by-ledger/:ledgerId | Transaction access helper | protect + canAccessTransactions |
| GET | /api/erp-accounting/attachments/download/:type/:filename | Authenticated + record-level access checks | protect + record-level access checks |

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
