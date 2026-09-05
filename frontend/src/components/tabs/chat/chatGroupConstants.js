const GROUP_MODULES = [
  { key: 'dashboard', label: 'Dashboard', desc: 'View dashboard and reports', icon: '▣', tone: '#EEF2FF' },
  { key: 'accounts', label: 'Accounts', desc: 'Manage accounts and ledgers', icon: '☷', tone: '#EFF6FF' },
  { key: 'mappings', label: 'Mappings', desc: 'Manage mappings', icon: '⌘', tone: '#EEF2FF' },
  { key: 'settings', label: 'Settings', desc: 'System settings and preferences', icon: '⚙', tone: '#FCE7F3' },
  { key: 'currencies', label: 'Currency Master', desc: 'Manage currencies', icon: '⛓', tone: '#E0F2FE' },
  { key: 'enquiry', label: 'Account Summary', desc: 'View account summary', icon: '▤', tone: '#E0F2FE' },
  { key: 'customers', label: 'Customers', desc: 'Manage customer data', icon: '♙', tone: '#FCE7F3' },
  { key: 'customer-margin', label: 'Customer Margin', desc: 'View customer margins', icon: '◉', tone: '#FEF3C7' },
  { key: 'supplier-margin', label: 'Supplier Margin', desc: 'View supplier margins', icon: '⌁', tone: '#EEF2FF' },
  { key: 'ledger', label: 'Ledger', desc: 'View ledger and entries', icon: '□', tone: '#E0F2FE' },
  { key: 'transactions', label: 'Transactions', desc: 'Manage transactions', icon: '⌘', tone: '#E0F2FE' },
  { key: 'reports', label: 'Reports', desc: 'View and export reports', icon: '◰', tone: '#FCE7F3' },
  { key: 'vendors', label: 'Vendors', desc: 'Manage vendors', icon: '♧', tone: '#E0F2FE' },
  { key: 'inventory', label: 'Inventory', desc: 'Manage inventory', icon: '▧', tone: '#DCFCE7' },
  { key: 'direct-deals', label: 'Fixing Deals', desc: 'Manage fixing deals', icon: '⌘', tone: '#FEF3C7' },
  { key: 'fixing-register', label: 'Net Position', desc: 'View net position', icon: '☷', tone: '#FCE7F3' },
]

const DEFAULT_GROUP_PERMISSIONS = GROUP_MODULES.reduce((acc, item, index) => {
  acc[item.key] = index < 8 || ['reports', 'vendors', 'inventory', 'direct-deals', 'fixing-register'].includes(item.key)
  return acc
}, {})

const GROUP_TEMPLATES = [
  { label: 'Admin Full Access', desc: 'All modules and permissions', color: '#10B981', bg: '#ECFDF5' },
  { label: 'Department Head', desc: 'Department management access', color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Read Only', desc: 'View access to all modules', color: '#8B5CF6', bg: '#F5F3FF' },
  { label: 'Finance Access', desc: 'Finance and accounts access', color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Operations Access', desc: 'Operations and inventory access', color: '#22C55E', bg: '#F0FDF4' },
]

const defaultGroupForm = () => ({
  name: '',
  dept: '',
  description: '',
  members: [],
  permissions: { ...DEFAULT_GROUP_PERMISSIONS },
  settings: {
    allowCreate: true,
    allowEdit: true,
    allowDelete: false,
    exportData: true,
  },
})


export {
  GROUP_MODULES,
  DEFAULT_GROUP_PERMISSIONS,
  GROUP_TEMPLATES,
  defaultGroupForm,
}
