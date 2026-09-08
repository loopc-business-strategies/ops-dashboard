import { isPrimaryNavClick } from '../../utils/dashboardNavigation'

/**
 * Sidebar nav item — presentation only; navigation rules live in getNavItems.
 */
export function NavItem({
  label,
  active,
  href,
  onAfterClick,
  badge,
  openInNewTab = false,
  onSameTabNavigate,
  onPrefetch,
}) {
  const className = `sidebar-item w-full${active ? ' active' : ''}`
  const style = { textDecoration: 'none', display: 'flex', alignItems: 'center' }
  const prefetchHandlers = {
    onMouseEnter: () => onPrefetch?.(),
    onFocus: () => onPrefetch?.(),
  }

  if (openInNewTab) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onAfterClick?.()}
        className={className}
        style={style}
        {...prefetchHandlers}
      >
        <span className="sidebar-item-label truncate">{label}</span>
        {badge != null && badge !== '' && badge !== 0 && (
          <span className="sidebar-badge">{badge}</span>
        )}
      </a>
    )
  }

  return (
    <a
      href={href}
      onClick={(event) => {
        if (!isPrimaryNavClick(event)) return
        event.preventDefault()
        onSameTabNavigate?.()
        onAfterClick?.()
      }}
      className={className}
      style={style}
      {...prefetchHandlers}
    >
      <span className="sidebar-item-label truncate">{label}</span>
      {badge != null && badge !== '' && badge !== 0 && (
        <span className="sidebar-badge">{badge}</span>
      )}
    </a>
  )
}

/**
 * All sidebar tabs — IDs, groups, and visibility rules must stay unchanged.
 */
export function getNavItems(perms, t, chatUnread = 0, branding) {
  const canShowErpSubTab = (subTab) => (
    perms.canViewERP && (!perms.canViewERPSubTab || perms.canViewERPSubTab(subTab))
  )
  const rawItems = [
    { id: 'overview', label: t('overview'), group: 'main', show: perms.canViewModule('overview') },
    { id: 'chat', label: t('chat'), group: 'main', show: perms.canViewModule('chat'), badge: chatUnread || null },
    { id: 'master-settings', label: 'Master Settings', group: 'main', show: true },
    { id: 'admin', label: t('admin'), group: 'admin', show: perms.canViewAdmin },
    { id: 'hr', label: t('hr'), group: 'departments', show: perms.canViewModule('hr') },
    { id: 'compliance', label: t('compliance'), group: 'departments', show: perms.canViewModule('government') },
    { id: 'production', label: t('production'), group: 'departments', show: perms.canViewModule('production') },
    { id: 'finance', label: t('finance'), group: 'departments', show: perms.canViewModule('finance') },
    { id: 'sales', label: t('sales'), group: 'departments', show: perms.canViewModule('sales') },
    { id: 'operations', label: t('operations'), group: 'departments', show: perms.canViewModule('operations') },
    { id: 'training', label: t('training'), group: 'departments', show: perms.canViewModule('training') },
    { id: 'erp-dashboard', label: 'Dashboard', group: 'erp', erpSub: 'dashboard', show: canShowErpSubTab('dashboard') },
    { id: 'erp-accounts', label: 'Accounts', group: 'erp', erpSub: 'accounts', show: canShowErpSubTab('accounts') },
    { id: 'erp-mappings', label: 'Mappings', group: 'erp', erpSub: 'mappings', show: canShowErpSubTab('mappings') },
    { id: 'erp-settings', label: 'Settings', group: 'erp', erpSub: 'settings', show: canShowErpSubTab('settings') },
    { id: 'erp-currencies', label: 'Currency Master', group: 'erp', erpSub: 'currencies', show: canShowErpSubTab('currencies') },
    { id: 'erp-enquiry', label: 'Account Summary', group: 'erp', erpSub: 'enquiry', show: canShowErpSubTab('enquiry') },
    { id: 'erp-customers', label: 'Customers', group: 'erp', erpSub: 'customers', show: canShowErpSubTab('customers') },
    { id: 'erp-customer-margin', label: 'Customer Margin', group: 'erp', erpSub: 'customer-margin', show: canShowErpSubTab('customer-margin') },
    { id: 'erp-supplier-margin', label: 'Supplier Margin', group: 'erp', erpSub: 'supplier-margin', show: canShowErpSubTab('supplier-margin') },
    { id: 'erp-ledger', label: 'Ledger', group: 'erp', erpSub: 'ledger', show: canShowErpSubTab('ledger') },
    { id: 'erp-period-closing', label: 'Period Closing', group: 'erp', erpSub: 'period-closing', show: Boolean(branding?.featureFlags?.accountingPeriodClosing) && canShowErpSubTab('period-closing') },
    { id: 'erp-transactions', label: 'Transactions', group: 'erp', erpSub: 'transactions', show: canShowErpSubTab('transactions') },
    { id: 'erp-reports', label: 'Reports', group: 'erp', erpSub: 'reports', show: canShowErpSubTab('reports') },
    { id: 'erp-vendors', label: 'Vendors', group: 'erp', erpSub: 'vendors', show: canShowErpSubTab('vendors') },
    { id: 'erp-inventory', label: 'Inventory', group: 'erp', erpSub: 'inventory', show: canShowErpSubTab('inventory') },
    { id: 'erp-vouchers', label: 'Vouchers', group: 'erp', erpSub: 'vouchers', show: canShowErpSubTab('vouchers') },
    { id: 'erp-direct-deals', label: 'Fixing Deals', group: 'erp', erpSub: 'direct-deals', show: canShowErpSubTab('direct-deals') },
    { id: 'erp-fixing-register', label: 'Net Position', group: 'erp', erpSub: 'fixing-register', show: canShowErpSubTab('fixing-register') },
    { id: 'procurement-plus', label: 'Procurement Plus', group: 'departments', show: Boolean(branding?.featureFlags?.procurementPlus) && perms.canViewModule('procurement-plus') },
  ]

  return rawItems
    .filter((item) => item.show)
    .filter((item) => {
      if (!branding) return true
      if (item.group === 'erp') return branding.enabledErpSubTabs.includes(item.erpSub)
      if (item.id === 'admin') return branding.enabledTabs.includes('admin')
      if (item.group === 'main' || item.group === 'departments') return branding.enabledTabs.includes(item.id)
      return true
    })
}
