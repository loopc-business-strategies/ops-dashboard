// FILE: src/pages/Dashboard.jsx
// Main dashboard shell — sidebar navigation + lazy-loaded tab modules.

import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage, LANGUAGES } from '../context/LanguageContext'
import { getTenantBranding } from '../config/tenantBranding'
import { resolveAllowedErpSubTab } from '../utils/erpSubTabPermissions'
import BuildInfoBadge from '../components/BuildInfoBadge'
import TopbarMetalTickers from '../components/TopbarMetalTickers'
import { startUserNotifications } from '../utils/realtimeSocket'

// Import tab content components
import OverviewTab     from '../components/tabs/OverviewTab'
const AdminTab = lazy(() => import('../components/tabs/AdminTab'))
const HRTab = lazy(() => import('../components/tabs/HRTab'))
const FinanceTab = lazy(() => import('../components/tabs/FinanceTab'))
const ProductionTab = lazy(() => import('../components/tabs/ProductionTab'))
const ChatTab = lazy(() => import('../components/tabs/ChatTab'))
const TrainingTab = lazy(() => import('../components/tabs/TrainingTab'))
const OperationsTab = lazy(() => import('../components/tabs/OperationsTab'))
const SalesTab = lazy(() => import('../components/tabs/SalesTab'))
const ERPTab = lazy(() => import('../components/tabs/ERPTab'))
const ComplianceTab = lazy(() => import('../components/tabs/ComplianceTab'))
const ProcurementPlusTab = lazy(() => import('../components/tabs/ProcurementPlusTab'))

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border" style={{ background: '#FFFFFF', borderColor: '#E5E7EB', color: '#1C2A33' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>This module failed to load.</p>
          <p style={{ margin: '8px 0 0', color: '#6B7280', fontSize: 14 }}>The rest of the dashboard is still available. Switch tabs or reload the page.</p>
        </div>
      )
    }

    return this.props.children
  }
}

function TabLoadingFallback() {
  return (
    <div className="p-6 rounded-xl border" style={{ background: '#FFFFFF', borderColor: '#E5E7EB', color: '#1C2A33' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Loading module...</p>
    </div>
  )
}

// ── Sidebar nav item ────────────────────────────
function NavItem({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      className={`sidebar-item w-full justify-center text-center${active ? ' active' : ''}`}>
      <span className="truncate">{label}</span>
      {badge && (
        <span style={{ fontSize: 11, background: 'var(--purple)', color: '#fff', borderRadius: 999, padding: '1px 6px', lineHeight: 1.4 }}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ── All sidebar tabs definition ─────────────────
function getNavItems(perms, t, chatUnread = 0, branding) {
  const canShowErpSubTab = (subTab) => (
    perms.canViewERP && (!perms.canViewERPSubTab || perms.canViewERPSubTab(subTab))
  )
  const rawItems = [
    // ── Main ──
    { id: 'overview',    label: t('overview'),    group: 'main',       show: perms.canViewModule('overview') },
    { id: 'chat',        label: t('chat'),        group: 'main',       show: perms.canViewModule('chat'), badge: chatUnread || null },

    // ── Admin (super_admin only) ──
    { id: 'admin',       label: t('admin'),       group: 'admin',      show: perms.canViewAdmin },

    // ── Departments ──
    { id: 'hr',          label: t('hr'),          group: 'departments', show: perms.canViewModule('hr') },
    { id: 'compliance',  label: t('compliance'),  group: 'departments', show: perms.canViewModule('government') },
    { id: 'production',  label: t('production'),  group: 'departments', show: perms.canViewModule('production') },
    { id: 'finance',     label: t('finance'),     group: 'departments', show: perms.canViewModule('finance') },
    { id: 'sales',       label: t('sales'),       group: 'departments', show: perms.canViewModule('sales') },
    { id: 'operations',  label: t('operations'),  group: 'departments', show: perms.canViewModule('operations') },
    { id: 'training',    label: t('training'),    group: 'departments', show: perms.canViewModule('training') },
    { id: 'erp-dashboard',    label: 'Dashboard',      group: 'erp', erpSub: 'dashboard',    show: canShowErpSubTab('dashboard') },
    { id: 'erp-accounts',     label: 'Accounts',       group: 'erp', erpSub: 'accounts',     show: canShowErpSubTab('accounts') },
    { id: 'erp-mappings',     label: 'Mappings',       group: 'erp', erpSub: 'mappings',     show: canShowErpSubTab('mappings') },
    { id: 'erp-settings',     label: 'Settings',       group: 'erp', erpSub: 'settings',     show: canShowErpSubTab('settings') },
    { id: 'erp-currencies',   label: 'Currency Master',group: 'erp', erpSub: 'currencies',   show: canShowErpSubTab('currencies') },
    { id: 'erp-enquiry',      label: 'Account Summary',group: 'erp', erpSub: 'enquiry',      show: canShowErpSubTab('enquiry') },
    { id: 'erp-customers',        label: 'Customers',       group: 'erp', erpSub: 'customers',       show: canShowErpSubTab('customers') },
    { id: 'erp-customer-margin',  label: 'Customer Margin', group: 'erp', erpSub: 'customer-margin', show: canShowErpSubTab('customer-margin') },
    { id: 'erp-supplier-margin',  label: 'Supplier Margin', group: 'erp', erpSub: 'supplier-margin', show: canShowErpSubTab('supplier-margin') },
    { id: 'erp-ledger',           label: 'Ledger',          group: 'erp', erpSub: 'ledger',          show: canShowErpSubTab('ledger') },
    { id: 'erp-transactions', label: 'Transactions',   group: 'erp', erpSub: 'transactions', show: canShowErpSubTab('transactions') },
    { id: 'erp-reports',      label: 'Reports',        group: 'erp', erpSub: 'reports',      show: canShowErpSubTab('reports') },
    { id: 'erp-vendors',      label: 'Vendors',        group: 'erp', erpSub: 'vendors',      show: canShowErpSubTab('vendors') },
    { id: 'erp-inventory',    label: 'Inventory',      group: 'erp', erpSub: 'inventory',    show: canShowErpSubTab('inventory') },
    { id: 'erp-vouchers',     label: 'Vouchers',       group: 'erp', erpSub: 'vouchers',     show: canShowErpSubTab('vouchers') },
    { id: 'erp-direct-deals',    label: 'Direct Deals',    group: 'erp', erpSub: 'direct-deals',    show: canShowErpSubTab('direct-deals') },
    { id: 'erp-fixing-register', label: 'Fixing Register', group: 'erp', erpSub: 'fixing-register', show: canShowErpSubTab('fixing-register') },
    { id: 'procurement-plus', label: 'Procurement Plus', group: 'departments', show: Boolean(branding?.featureFlags?.procurementPlus) && (!perms.hasGranularPermissions || perms.canViewModule('procurement-plus')) },
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

// ── Render the content for each tab ────────────
function renderTab(tabId, setActiveTab, setChatUnread, erpSubTab) {
  switch (tabId) {
    case 'overview':
      return <OverviewTab onNavigate={setActiveTab} />

    case 'chat':
      return <ChatTab onUnreadChange={setChatUnread} onBack={() => setActiveTab('erp')} />

    case 'admin':
      return <AdminTab />

    case 'hr':
      return <HRTab />

    case 'compliance':
      return <ComplianceTab />

    case 'production':
      return <ProductionTab />

    case 'finance':
      return <FinanceTab />

    case 'sales':
      return <SalesTab />

    case 'operations':
      return <OperationsTab />

    case 'training':
      return <TrainingTab />

    case 'erp':
      return <ERPTab focusTab={erpSubTab} onNavigateMain={setActiveTab} />

    case 'procurement-plus':
      return <ProcurementPlusTab />

    default:
      return (
        <div className="text-center py-20 text-gray-500">
          <p>Select a tab from the sidebar</p>
        </div>
      )
  }
}

function renderTabContent(tabId, setActiveTab, setChatUnread, erpSubTab) {
  return (
    <TabErrorBoundary resetKey={tabId}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTab(tabId, setActiveTab, setChatUnread, erpSubTab)}
      </Suspense>
    </TabErrorBoundary>
  )
}

// ══════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════
function Dashboard() {
  const { user, token, logout, company } = useAuth()
  const perms = usePermissions()
  const navigate = useNavigate()
  const { t, isRTL, switchLanguage, langMeta } = useLanguage()

  const [activeTab,    setActiveTab]    = useState('overview')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [adminOpen,    setAdminOpen]    = useState(true)
  const [deptOpen,     setDeptOpen]     = useState(true)
  const [erpOpen,      setErpOpen]      = useState(true)
  const [erpSubTab,    setErpSubTab]    = useState('dashboard')
  const [chatUnread,   setChatUnread]   = useState(0)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const langMenuRef = useRef(null)
  const notifMenuRef = useRef(null)
  const accountMenuRef = useRef(null)

  const DESKTOP_MIN_WIDTH = 1024
  const DESKTOP_SIDEBAR_WIDTH = 216
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_MIN_WIDTH : true
  ))
  const EDGE_TRIGGER_WIDTH = 20
  const HIDE_DELAY_MS = 400
  const HIDE_THRESHOLD_X = 320
  const hideTimerRef = useRef(null)

  const branding = useMemo(() => getTenantBranding(user?.company || company), [company, user?.company])
  const navItems = getNavItems(perms, t, chatUnread, branding)

  useEffect(() => {
    const firstAllowed = navItems[0]
    if (!firstAllowed) return

    if (activeTab === 'erp') {
      const currentErpItem = navItems.find((item) => item.group === 'erp' && item.erpSub === erpSubTab)
      if (currentErpItem) return

      const firstErpItem = navItems.find((item) => item.group === 'erp')
      if (firstErpItem) {
        setErpSubTab(firstErpItem.erpSub)
        return
      }

      setActiveTab(firstAllowed.group === 'erp' ? 'erp' : firstAllowed.id)
      if (firstAllowed.group === 'erp') setErpSubTab(firstAllowed.erpSub)
      return
    }

    const currentItem = navItems.find((item) => item.id === activeTab)
    if (currentItem) return

    setActiveTab(firstAllowed.group === 'erp' ? 'erp' : firstAllowed.id)
    if (firstAllowed.group === 'erp') setErpSubTab(firstAllowed.erpSub)
  }, [activeTab, erpSubTab, navItems])

  useEffect(() => {
    const root = document.documentElement
    const prevPrimary = root.style.getPropertyValue('--purple')
    const prevSecondary = root.style.getPropertyValue('--purple-light')
    const prevTopbar = root.style.getPropertyValue('--bg-topbar')
    const prevGradBrand = root.style.getPropertyValue('--grad-brand')
    const prevGradBar = root.style.getPropertyValue('--grad-bar')

    const hexToRgb = (hex) => { const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16); const g=parseInt(h.slice(2,4),16); const b=parseInt(h.slice(4,6),16); return `${r}, ${g}, ${b}` }
    root.style.setProperty('--purple', branding.colors.brandPrimary)
    root.style.setProperty('--purple-light', branding.colors.brandSecondary)
    root.style.setProperty('--purple-rgb', hexToRgb(branding.colors.brandPrimary))
    root.style.setProperty('--bg-topbar', branding.colors.bgTopbar)
    root.style.setProperty('--grad-brand', `linear-gradient(135deg, ${branding.colors.brandPrimary}, ${branding.colors.brandSecondary})`)
    root.style.setProperty('--grad-bar', branding.colors.gradBar)

    return () => {
      root.style.setProperty('--purple', prevPrimary)
      root.style.setProperty('--purple-light', prevSecondary)
      root.style.setProperty('--bg-topbar', prevTopbar)
      root.style.setProperty('--grad-brand', prevGradBrand)
      root.style.setProperty('--grad-bar', prevGradBar)
    }
  }, [branding])

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const closeSidebar = () => {
    clearHideTimer()
    setSidebarOpen(false)
  }

  const openSidebar = () => {
    clearHideTimer()
    setSidebarOpen(true)
  }

  const queueHideSidebar = () => {
    if (!isDesktop) return
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setSidebarOpen(false)
      hideTimerRef.current = null
    }, HIDE_DELAY_MS)
  }

  useEffect(() => {
    return () => clearHideTimer()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [DESKTOP_MIN_WIDTH])

  // Close language menu when clicking outside
  useEffect(() => {
    if (!langMenuOpen) return
    const handler = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [langMenuOpen])

  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  useEffect(() => {
    if (!accountMenuOpen) return
    const handler = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!user) return undefined

    return startUserNotifications({
      token,
      onNotification: (payload) => {
        const data = payload?.data || {}
        const isTransactionChatMention = payload?.type === 'transaction_chat_mention'
        setNotifications((prev) => [
          {
            id: `rt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            title: isTransactionChatMention ? 'Transaction chat mention' : 'New notification',
            msg: isTransactionChatMention
              ? `${data.senderName || 'A user'} mentioned you: ${data.message || ''}`
              : data.message || payload?.type || 'Notification received',
            time: 'Just now',
            read: false,
            dotColor: isTransactionChatMention ? 'bg-blue-400' : 'bg-green-400',
          },
          ...prev,
        ])
      },
    })
  }, [token, user])

  // Sync active tab from URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam) {
      if (tabParam.startsWith('erp-')) {
        setActiveTab('erp')
        setErpSubTab(resolveAllowedErpSubTab(user, tabParam.replace('erp-', ''), 'dashboard'))
      } else {
        setActiveTab(tabParam)
      }
    }
  }, [user])

  const handleShellMouseMove = (e) => {
    if (!isDesktop) return

    const x = e.clientX

    if (x <= EDGE_TRIGGER_WIDTH) {
      if (!sidebarOpen) openSidebar()
      else clearHideTimer()
      return
    }

    if (sidebarOpen && x > HIDE_THRESHOLD_X) {
      queueHideSidebar()
    }
  }

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId)
    if (!isDesktop) closeSidebar()
  }

  const handleErpTabSelect = (subTab) => {
    setActiveTab('erp')
    setErpSubTab(subTab)
    if (!isDesktop) closeSidebar()
  }

  const toggleSidebar = () => {
    clearHideTimer()
    setSidebarOpen((prev) => !prev)
  }

  // Group nav items
  const mainItems  = navItems.filter(n => n.group === 'main')
  const adminItems = navItems.filter(n => n.group === 'admin')
  const deptItems  = navItems.filter(n => n.group === 'departments')
  const erpItems   = navItems.filter(n => n.group === 'erp')

  const handleLogout = () => { logout(); navigate('/login') }
  const languageCode = (langMeta?.code || 'en').toUpperCase()
  const tenantShortCode = (branding.displayName || user?.company || company || 'NA')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'NA'
  const accountRoleLabel = user?.role === 'super_admin'
    ? t('superAdmin')
    : (user?.role || 'user').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())

  // Find current tab label
  const currentTab = navItems.find(n => n.id === activeTab)


  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100vh' }} onMouseMove={handleShellMouseMove}>

      {/* Desktop edge sensor: reveal sidebar when mouse nears left/right edge */}
      {isDesktop && !sidebarOpen && (
        <div
          className={`fixed inset-y-0 z-40 ${isRTL ? 'right-0' : 'left-0'}`}
          style={{ width: EDGE_TRIGGER_WIDTH }}
          onMouseEnter={openSidebar}
        />
      )}

      {/* ══════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════ */}
      <aside
        className={`sidebar fixed inset-y-0 z-50 flex flex-col transform transition-transform duration-300 ease-in-out
          ${isRTL ? 'right-0' : 'left-0'}
          ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        `}
        onMouseEnter={isDesktop ? clearHideTimer : undefined}
        onMouseLeave={isDesktop ? queueHideSidebar : undefined}>

        {/* Sidebar top — logo */}
        <div className="sidebar-logo flex-shrink-0">
          <div className="flex items-center gap-3">
            {branding.logoImage ? (
              <img
                src={branding.logoImage}
                alt={`${branding.displayName} logo`}
                className="h-8 rounded-lg flex-shrink-0"
                style={{ width: 52, objectFit: 'contain', background: '#FFFFFF' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: 'var(--grad-brand)' }}>
                <span style={{ color: 'white', fontWeight: 700, letterSpacing: 0.4 }}>{branding.logoText}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: '#1C2A33' }}>{branding.displayName} Ops</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t('controlSystem')}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">

          {/* Main */}
          {mainItems.map(item => (
            <NavItem key={item.id} {...item}
              active={activeTab === item.id}
              onClick={() => handleTabSelect(item.id)} />
          ))}

          {/* Divider before Admin */}
          {adminItems.length > 0 && <div className="sidebar-divider" />}

          {/* Admin section */}
          {adminItems.length > 0 && (
            <>
              <button className="sidebar-section-title w-full justify-center gap-2"
                onClick={() => setAdminOpen(v => !v)}>
                <span>{t('adminSection')}</span>
                <span className="section-chevron">{adminOpen ? '▴' : '▾'}</span>
              </button>
              {adminOpen && adminItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === item.id}
                  onClick={() => handleTabSelect(item.id)} />
              ))}
            </>
          )}

          {/* Divider before Departments */}
          {deptItems.length > 0 && <div className="sidebar-divider" />}

          {/* Departments */}
          {deptItems.length > 0 && (
            <>
              <button className="sidebar-section-title w-full justify-center gap-2"
                onClick={() => setDeptOpen(v => !v)}>
                <span>{t('departments')}</span>
                <span className="section-chevron">{deptOpen ? '▴' : '▾'}</span>
              </button>
              {deptOpen && deptItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === item.id}
                  onClick={() => handleTabSelect(item.id)} />
              ))}
            </>
          )}

          {/* Divider before ERP */}
          {erpItems.length > 0 && <div className="sidebar-divider" />}

          {/* ERP */}
          {erpItems.length > 0 && (
            <>
              <button className="sidebar-section-title w-full justify-center gap-2"
                onClick={() => setErpOpen(v => !v)}>
                <span>{t('erp')}</span>
                <span className="section-chevron">{erpOpen ? '▴' : '▾'}</span>
              </button>
              {erpOpen && erpItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === 'erp' && erpSubTab === item.erpSub}
                  onClick={() => handleErpTabSelect(item.erpSub)} />
              ))}
            </>
          )}

        </nav>

        {/* Sidebar bottom — logout */}
        <div className="sidebar-footer flex-shrink-0 inline">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('signOut')}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && !isDesktop && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
          onClick={closeSidebar} />
      )}

      {/* ══════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════ */}
      <div
        className="flex-1 w-full h-full flex flex-col min-w-0 transition-all duration-300"
        style={isDesktop && sidebarOpen
          ? (isRTL
              ? { marginRight: DESKTOP_SIDEBAR_WIDTH }
              : { marginLeft: DESKTOP_SIDEBAR_WIDTH })
          : undefined}
      >

        {/* Top header bar */}
        <header className="topbar sticky top-0 z-30 flex-shrink-0">
          <div className="flex w-full items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
              {/* Hamburger */}
              <button onClick={toggleSidebar}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Breadcrumb */}
              <div className="min-w-0">
                <h1 className="topbar-title">
                  {currentTab?.label || t('dashboard')}
                </h1>
                <p className="topbar-subtitle hidden sm:block">
                  {branding.displayName} | {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>

            {/* Right side of header: tenant metal tickers sit here before notif / language / user */}
            <div className="flex items-center justify-end gap-2 flex-nowrap flex-shrink-0 min-w-0">
              {['mg', 'cg', 'loopc'].includes(branding.key) && (
                <div className="hidden md:flex items-center shrink-0 min-w-0 overflow-hidden">
                  <TopbarMetalTickers token={token} tenant={branding.key} />
                </div>
              )}
              {!['mg', 'cg', 'loopc'].includes(branding.key) && <BuildInfoBadge className="hidden md:inline-flex" />}

              {/* Read-only badge */}
              {perms.isReadOnly && (
                <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]"
                  style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                  🔒 {t('readOnly')}
                </span>
              )}

              {/* Notification dropdown */}
              <div className="relative" ref={notifMenuRef}>
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="relative h-7 w-7 rounded-lg transition-all inline-flex items-center justify-center"
                  style={{
                    background: notifOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                  </svg>
                  {notifications.length > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontWeight: 700 }}>
                      {notifications.length}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    className="absolute mt-1 py-1 rounded-xl shadow-2xl"
                    style={{
                      right: 0,
                      top: '100%',
                      minWidth: 320,
                      zIndex: 9999,
                      background: '#ffffff',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 12px 28px rgba(15,23,42,0.2)',
                    }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#111827' }}>
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '14px 12px', color: '#6B7280', fontSize: 12 }}>
                        No notifications yet.
                      </div>
                    ) : notifications.map((n) => (
                      <div key={n.id} style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.title}</p>
                        {n.msg && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4B5563' }}>{n.msg}</p>}
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{n.time}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Language switcher */}
              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangMenuOpen(v => !v)}
                  title={t('language')}
                  className="flex items-center gap-1 px-2 h-7 rounded-lg text-xs transition-all"
                  style={{
                    background: langMenuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.85 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9zM3 12a9 9 0 019-9 9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-9-9z" />
                  </svg>
                  <span className="hidden sm:inline font-semibold" style={{ fontSize: 11 }}>{languageCode} {langMeta.nativeLabel}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5, marginTop: 1 }}>
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {langMenuOpen && (
                  <div
                    className="absolute mt-1 py-1 rounded-xl shadow-2xl"
                    style={{
                      [isRTL ? 'left' : 'right']: 0,
                      top: '100%',
                      minWidth: 170,
                      zIndex: 9999,
                      background: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    }}>
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { switchLanguage(lang.code); setLangMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all"
                        style={{
                          color: lang.code === langMeta.code ? '#a78bfa' : 'rgba(255,255,255,0.8)',
                          background: lang.code === langMeta.code ? 'rgba(139,92,246,0.15)' : 'transparent',
                          fontWeight: lang.code === langMeta.code ? 600 : 400,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                        onMouseEnter={e => { if (lang.code !== langMeta.code) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                        onMouseLeave={e => { if (lang.code !== langMeta.code) e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{lang.flag}</span>
                        <span style={{ flex: 1 }}>{lang.nativeLabel}</span>
                        {lang.code === langMeta.code && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7l3.5 3.5L12 3" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account dropdown */}
              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setAccountMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2 h-7 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                  <span
                    className="hidden lg:inline-flex items-center justify-center rounded px-1.5"
                    style={{
                      height: 16,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}>
                    {tenantShortCode}
                  </span>
                  <div className="w-5.5 h-5.5 rounded-md flex items-center justify-center font-bold text-white text-[11px]"
                    style={{ background: 'var(--grad-brand)' }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline text-xs" style={{ color: '#fff', fontWeight: 600 }}>{user?.name}</span>
                  <span
                    className="hidden xl:inline-flex items-center rounded px-1.5"
                    style={{
                      height: 16,
                      background: 'rgba(59,130,246,0.22)',
                      border: '1px solid rgba(96,165,250,0.4)',
                      color: '#93c5fd',
                      fontSize: 9,
                      fontWeight: 700,
                    }}>
                    {accountRoleLabel}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.7 }}>
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {accountMenuOpen && (
                  <div
                    className="absolute mt-1 py-1 rounded-xl shadow-2xl"
                    style={{
                      right: 0,
                      top: '100%',
                      minWidth: 220,
                      zIndex: 9999,
                      background: '#ffffff',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 12px 28px rgba(15,23,42,0.2)',
                    }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>{user?.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{branding.displayName} · {accountRoleLabel}</p>
                    </div>
                    <button
                      onClick={() => { setAccountMenuOpen(false); handleLogout() }}
                      className="w-full px-3 py-2.5 text-sm"
                      style={{ textAlign: 'left', color: '#b91c1c', fontWeight: 600 }}>
                      {t('signOut')}
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* Page content — 1.5rem inset matches ERP module padding; chat stays full-bleed inside scroll area */}
        <main
          className={`flex-1 flex flex-col min-h-0 ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
        >
          {activeTab === 'chat' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {renderTabContent(activeTab, setActiveTab, setChatUnread, erpSubTab)}
            </div>
          ) : (
            <div className="flex-1 min-h-0" style={{ padding: '1.5rem', boxSizing: 'border-box' }}>
              {renderTabContent(activeTab, setActiveTab, setChatUnread, erpSubTab)}
            </div>
          )}
        </main>

      </div>
    </div>
  )
}

export default Dashboard
