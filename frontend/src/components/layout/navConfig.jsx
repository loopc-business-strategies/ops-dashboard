import { isPrimaryNavClick } from '../../utils/dashboardNavigation'
import { useLanguage } from '../../context/LanguageContext'

function ComingSoonLockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

/**
 * Sidebar nav item — presentation only; navigation rules live in getNavItems.
 */
export function NavItem({
  label,
  active,
  href,
  onAfterClick,
  badge,
  comingSoon = false,
  openInNewTab = false,
  onSameTabNavigate,
  onPrefetch,
}) {
  const { t } = useLanguage()
  const className = `sidebar-item w-full${active ? ' active' : ''}${comingSoon ? ' sidebar-item--coming-soon' : ''}`
  const style = { textDecoration: 'none', display: 'flex', alignItems: 'center' }
  const prefetchHandlers = {
    onMouseEnter: () => onPrefetch?.(),
    onFocus: () => onPrefetch?.(),
  }
  // Keep lock out of the accessible name so getByRole('link', { name }) matches the label.
  const lock = comingSoon ? (
    <span className="sidebar-item-lock" title={t('comingSoon')} aria-hidden="true">
      <ComingSoonLockIcon />
    </span>
  ) : null

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
        {lock}
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
      {lock}
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
  const departmentsComingSoon = Boolean(branding?.featureFlags?.departmentsComingSoon)
  const rawItems = [
    {
      id: 'overview',
      label: t('overview'),
      group: 'main',
      comingSoon: departmentsComingSoon,
      show: departmentsComingSoon || perms.canViewModule('overview'),
    },
    {
      id: 'chat',
      label: t('chat'),
      group: 'main',
      comingSoon: departmentsComingSoon,
      show: departmentsComingSoon || perms.canViewModule('chat'),
      badge: departmentsComingSoon ? null : (chatUnread || null),
    },
    {
      id: 'master-settings',
      label: t('masterSettings'),
      group: 'main',
      comingSoon: departmentsComingSoon,
      show: true,
    },
    {
      id: 'departments',
      label: t('departments'),
      group: 'main',
      comingSoon: departmentsComingSoon,
      show: departmentsComingSoon,
    },
    { id: 'admin', label: t('admin'), group: 'admin', show: perms.canViewAdmin },
    { id: 'hr', label: t('hr'), group: 'departments', show: !departmentsComingSoon && perms.canViewModule('hr') },
    { id: 'compliance', label: t('compliance'), group: 'departments', show: !departmentsComingSoon && perms.canViewModule('government') },
    {
      id: 'production-new',
      label: t('productionDashboard'),
      group: 'departments',
      comingSoon: departmentsComingSoon,
      // MG/others: native <a target="_blank"> to fullscreen board (not window.open).
      // VB Coming Soon keeps in-dashboard.
      openInNewTab: !departmentsComingSoon,
      show: departmentsComingSoon || (!departmentsComingSoon && perms.canViewModule('production')),
    },
    { id: 'finance', label: t('finance'), group: 'departments', show: !departmentsComingSoon && perms.canViewModule('finance') },
    { id: 'sales', label: t('sales'), group: 'departments', show: !departmentsComingSoon && perms.canViewModule('sales') },
    {
      id: 'operations',
      label: t('operations'),
      group: 'departments',
      comingSoon: departmentsComingSoon,
      show: departmentsComingSoon || (
        !departmentsComingSoon && (perms.canViewModule('operations') || Boolean(perms.canApproveMgFloor))
      ),
    },
    { id: 'training', label: t('training'), group: 'departments', show: !departmentsComingSoon && perms.canViewModule('training') },
    { id: 'erp-dashboard', label: t('erpDashboard'), group: 'erp', erpSub: 'dashboard', show: canShowErpSubTab('dashboard') },
    { id: 'erp-accounts', label: t('erpAccounts'), group: 'erp', erpSub: 'accounts', show: canShowErpSubTab('accounts') },
    { id: 'erp-mappings', label: t('erpMappings'), group: 'erp', erpSub: 'mappings', show: canShowErpSubTab('mappings') },
    { id: 'erp-settings', label: t('settings'), group: 'erp', erpSub: 'settings', show: canShowErpSubTab('settings') },
    { id: 'erp-currencies', label: t('erpCurrencyMaster'), group: 'erp', erpSub: 'currencies', show: canShowErpSubTab('currencies') },
    { id: 'erp-enquiry', label: t('erpAccountSummary'), group: 'erp', erpSub: 'enquiry', show: canShowErpSubTab('enquiry') },
    { id: 'erp-customers', label: t('erpCustomers'), group: 'erp', erpSub: 'customers', show: canShowErpSubTab('customers') },
    { id: 'erp-customer-margin', label: t('erpCustomerMargin'), group: 'erp', erpSub: 'customer-margin', show: canShowErpSubTab('customer-margin') },
    { id: 'erp-supplier-margin', label: t('erpSupplierMargin'), group: 'erp', erpSub: 'supplier-margin', show: canShowErpSubTab('supplier-margin') },
    { id: 'erp-ledger', label: t('erpLedger'), group: 'erp', erpSub: 'ledger', show: canShowErpSubTab('ledger') },
    { id: 'erp-period-closing', label: t('erpPeriodClosing'), group: 'erp', erpSub: 'period-closing', show: Boolean(branding?.featureFlags?.accountingPeriodClosing) && canShowErpSubTab('period-closing') },
    { id: 'erp-transactions', label: t('erpTransactions'), group: 'erp', erpSub: 'transactions', show: canShowErpSubTab('transactions') },
    { id: 'erp-reports', label: t('erpReports'), group: 'erp', erpSub: 'reports', show: canShowErpSubTab('reports') },
    { id: 'erp-vendors', label: t('erpVendors'), group: 'erp', erpSub: 'vendors', show: canShowErpSubTab('vendors') },
    { id: 'erp-inventory', label: t('erpInventory'), group: 'erp', erpSub: 'inventory', show: canShowErpSubTab('inventory') },
    { id: 'erp-vouchers', label: t('erpVouchers'), group: 'erp', erpSub: 'vouchers', show: canShowErpSubTab('vouchers') },
    { id: 'erp-direct-deals', label: t('erpDirectDeals'), group: 'erp', erpSub: 'direct-deals', show: canShowErpSubTab('direct-deals') },
    { id: 'erp-fixing-register', label: t('erpNetPosition'), group: 'erp', erpSub: 'fixing-register', show: canShowErpSubTab('fixing-register') },
    { id: 'procurement-plus', label: t('procurementPlus'), group: 'departments', show: !departmentsComingSoon && Boolean(branding?.featureFlags?.procurementPlus) && perms.canViewModule('procurement-plus') },
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
