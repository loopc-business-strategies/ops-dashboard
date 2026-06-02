export const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access + user management' },
  { value: 'management', label: 'Management', desc: 'Read-only all dashboards' },
  { value: 'department_head', label: 'Dept. Head', desc: 'Own department leadership access' },
  { value: 'department_user', label: 'Dept. User', desc: 'Operational execution for assigned department' },
  { value: 'external', label: 'External', desc: 'Restricted selected modules only' },
] as const

export type UserRole = (typeof ROLES)[number]['value']

export const DEPTS = [
  { value: '', label: 'None' },
  { value: 'production', label: 'Production & Factory' },
  { value: 'hr', label: 'Hiring & HR' },
  { value: 'finance', label: 'Finance & Accounts' },
  { value: 'government', label: 'Govt. & Compliance' },
  { value: 'sales', label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations & Logistics' },
  { value: 'training', label: 'Training & Dev.' },
  { value: 'management', label: 'Management' },
] as const

export const ALL_MODULES = ['production', 'hr', 'finance', 'government', 'sales', 'operations', 'training', 'erp'] as const

export const ALL_PERM_ROWS = [
  { id: 'overview', label: 'Overview', group: 'GENERAL' },
  { id: 'chat', label: 'Chat', group: 'GENERAL' },
  { id: 'hr', label: 'Hiring & HR', group: 'DEPARTMENTS' },
  { id: 'production', label: 'Production & Factory', group: 'DEPARTMENTS' },
  { id: 'finance', label: 'Finance & Accounts', group: 'DEPARTMENTS' },
  { id: 'government', label: 'Govt. & Compliance', group: 'DEPARTMENTS' },
  { id: 'sales', label: 'Sales & Marketing', group: 'DEPARTMENTS' },
  { id: 'operations', label: 'Operations & Logistics', group: 'DEPARTMENTS' },
  { id: 'training', label: 'Training & Dev.', group: 'DEPARTMENTS' },
  { id: 'procurement-plus', label: 'Procurement Plus', group: 'DEPARTMENTS' },
] as const

export const ERP_PERMISSION_ROWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'settings', label: 'Settings' },
  { id: 'currencies', label: 'Currency Master' },
  { id: 'enquiry', label: 'Account Summary' },
  { id: 'customers', label: 'Customers' },
  { id: 'customer-margin', label: 'Customer Margin' },
  { id: 'supplier-margin', label: 'Supplier Margin' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'vouchers', label: 'Vouchers' },
  { id: 'direct-deals', label: 'Direct Deals' },
  { id: 'fixing-register', label: 'Net Position' },
] as const

export const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: '#DCFCE7', text: '#166534' },
  management: { bg: '#DBEAFE', text: '#1D4ED8' },
  department_head: { bg: '#FEF3C7', text: '#B45309' },
  department_user: { bg: '#F3F4F6', text: '#374151' },
  external: { bg: '#ECFCCB', text: '#3F6212' },
}

export type UserFormState = {
  name: string
  fullName: string
  password: string
  role: UserRole
  department: string
  allowedModules: string[]
  assignedTasks: string
  title: string
  phone: string
  location: string
  timezone: string
  employeeCode: string
  notes: string
}

export const EMPTY_USER_FORM: UserFormState = {
  name: '',
  fullName: '',
  password: '',
  role: 'department_user',
  department: '',
  allowedModules: [],
  assignedTasks: '',
  title: '',
  phone: '',
  location: '',
  timezone: 'Africa/Johannesburg',
  employeeCode: '',
  notes: '',
}

export type ModulePermissions = Record<
  string,
  { on?: boolean; view?: boolean; edit?: boolean; subs?: Record<string, { on?: boolean }> }
>
