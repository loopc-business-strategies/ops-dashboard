// FILE: src/pages/Dashboard.jsx
// PAGE 2 — Main dashboard after login
//
// LAYOUT:
//   Left sidebar — navigation tabs (Admin, HR, Compliance, etc.)
//   Right content — shows the selected tab's content
//
// TABS (sidebar):
//   Overview       → project snapshot, progress, activity
//   Admin          → user management, permissions (super_admin only)
//   HR             → placeholder (to be built)
//   Compliance     → placeholder (to be built)
//   Production     → placeholder (to be built)
//   Finance        → placeholder (to be built)
//   Sales          → placeholder (to be built)
//   Operations     → placeholder (to be built)
//   Training       → placeholder (to be built)

import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage, LANGUAGES } from '../context/LanguageContext'
import { getTenantBranding } from '../config/tenantBranding'
import BuildInfoBadge from '../components/BuildInfoBadge'
import axios from 'axios'

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
const PlaceholderTab = lazy(() => import('../components/tabs/PlaceholderTab'))

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
  const rawItems = [
    // ── Main ──
    { id: 'overview',    label: t('overview'),    group: 'main',       show: true },
    { id: 'chat',        label: t('chat'),        group: 'main',       show: true, badge: chatUnread || null },

    // ── Admin (super_admin only) ──
    { id: 'admin',       label: t('admin'),       group: 'admin',      show: true },

    // ── Departments ──
    { id: 'hr',          label: t('hr'),          group: 'departments', show: perms.canViewModule('hr') },
    { id: 'compliance',  label: t('compliance'),  group: 'departments', show: perms.canViewModule('government') },
    { id: 'production',  label: t('production'),  group: 'departments', show: perms.canViewModule('production') },
    { id: 'finance',     label: t('finance'),     group: 'departments', show: perms.canViewModule('finance') },
    { id: 'sales',       label: t('sales'),       group: 'departments', show: perms.canViewModule('sales') },
    { id: 'operations',  label: t('operations'),  group: 'departments', show: perms.canViewModule('operations') },
    { id: 'training',    label: t('training'),    group: 'departments', show: perms.canViewModule('training') },
    { id: 'erp-dashboard',    label: 'Dashboard',      group: 'erp', erpSub: 'dashboard',    show: perms.canViewERP },
    { id: 'erp-accounts',     label: 'Accounts',       group: 'erp', erpSub: 'accounts',     show: perms.canViewERP },
    { id: 'erp-mappings',     label: 'Mappings',       group: 'erp', erpSub: 'mappings',     show: perms.canViewERP },
    { id: 'erp-settings',     label: 'Settings',       group: 'erp', erpSub: 'settings',     show: perms.canViewERP },
    { id: 'erp-currencies',   label: 'Currency Master',group: 'erp', erpSub: 'currencies',   show: perms.canViewERP },
    { id: 'erp-enquiry',      label: 'Account Summary',group: 'erp', erpSub: 'enquiry',      show: perms.canViewERP },
    { id: 'erp-customers',        label: 'Customers',       group: 'erp', erpSub: 'customers',       show: perms.canViewERP },
    { id: 'erp-customer-margin',  label: 'Customer Margin', group: 'erp', erpSub: 'customer-margin', show: perms.canViewERP },
    { id: 'erp-ledger',           label: 'Ledger',          group: 'erp', erpSub: 'ledger',          show: perms.canViewERP },
    { id: 'erp-transactions', label: 'Transactions',   group: 'erp', erpSub: 'transactions', show: perms.canViewERP },
    { id: 'erp-reports',      label: 'Reports',        group: 'erp', erpSub: 'reports',      show: perms.canViewERP },
    { id: 'erp-vendors',      label: 'Vendors',        group: 'erp', erpSub: 'vendors',      show: perms.canViewERP },
    { id: 'erp-inventory',    label: 'Inventory',      group: 'erp', erpSub: 'inventory',    show: perms.canViewERP },
    { id: 'erp-vouchers',     label: 'Vouchers',       group: 'erp', erpSub: 'vouchers',     show: perms.canViewERP },
    { id: 'erp-direct-deals',    label: 'Direct Deals',    group: 'erp', erpSub: 'direct-deals',    show: perms.canViewERP },
    { id: 'erp-fixing-register', label: 'Fixing Register', group: 'erp', erpSub: 'fixing-register', show: perms.canViewERP },
    { id: 'procurement-plus', label: 'Procurement Plus', group: 'departments', show: Boolean(branding?.featureFlags?.procurementPlus) },
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
function renderTab(tabId, setActiveTab, setChatUnread, erpSubTab, onErpMetalRatesChange) {
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
      return <ERPTab focusTab={erpSubTab} onNavigateMain={setActiveTab} onMetalRatesChange={onErpMetalRatesChange} />

    case 'procurement-plus':
      return (
        <PlaceholderTab
          title="Procurement Plus"
          icon="🧩"
          description="Company-specific procurement controls module."
          subTabs={['Vendor Scoring', 'Contract Rules', 'Approval Matrix']}
        />
      )

    default:
      return (
        <div className="text-center py-20 text-gray-500">
          <p>Select a tab from the sidebar</p>
        </div>
      )
  }
}

function renderTabContent(tabId, setActiveTab, setChatUnread, erpSubTab, onErpMetalRatesChange) {
  return (
    <TabErrorBoundary resetKey={tabId}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTab(tabId, setActiveTab, setChatUnread, erpSubTab, onErpMetalRatesChange)}
      </Suspense>
    </TabErrorBoundary>
  )
}

// ══════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════
function Dashboard({
  goldPrice = 0,
  silverPrice = 0,
  platinumPrice = 0,
  palladiumPrice = 0,
  metalRatesUpdatedAt = null,
}) {
  const { user, logout, company } = useAuth()
  const perms = usePermissions()
  const navigate = useNavigate()
  const { t, isRTL, switchLanguage, langMeta } = useLanguage()

  const [activeTab,    setActiveTab]    = useState('overview')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [adminOpen,    setAdminOpen]    = useState(true)
  const [deptOpen,     setDeptOpen]     = useState(true)
  const [erpOpen,      setErpOpen]      = useState(true)
  const [erpSubTab,    setErpSubTab]    = useState('dashboard')
  const [chatUnread,   setChatUnread]   = useState(3) // matches seed data initial unread
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [metalMenuOpen, setMetalMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [selectedMetal, setSelectedMetal] = useState('gold')
  const [metalRates, setMetalRates] = useState({ gold: 0, silver: 0, platinum: 0 })
  const [showMetalDropdown, setShowMetalDropdown] = useState(false)
  const [latestMetalRates, setLatestMetalRates] = useState({
    goldPrice: null,
    silverPrice: null,
    platinumPrice: null,
    palladiumPrice: null,
    updatedAt: null,
  })
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Gold price updated', msg: 'XAU moved to USD 4,555', time: '2m ago', read: false, dotColor: 'bg-yellow-400' },
    { id: 2, title: 'Voucher submitted', msg: 'Payment #12 awaiting approval', time: '15m ago', read: false, dotColor: 'bg-blue-400' },
    { id: 3, title: 'System sync complete', msg: 'All accounts updated', time: '1h ago', read: true, dotColor: 'bg-green-400' },
  ])
  const langMenuRef = useRef(null)
  const metalMenuRef = useRef(null)
  const notifMenuRef = useRef(null)
  const accountMenuRef = useRef(null)

  const DESKTOP_MIN_WIDTH = 1024
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

  useEffect(() => {
    const handleClickOutside = () => {
      setShowMetalDropdown(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

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
    if (!metalMenuOpen) return
    const handler = (e) => {
      if (metalMenuRef.current && !metalMenuRef.current.contains(e.target)) {
        setMetalMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [metalMenuOpen])

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
    let mounted = true
    const fetchMetalRates = async () => {
      try {
        const res = await axios.get('/api/erp-accounting/metal-rates', { withCredentials: true })
        const rates = res.data?.rates || {}
        if (!mounted) return
        setMetalRates({
          gold: Number(rates.goldPrice || 0),
          silver: Number(rates.silverPrice || 0),
          platinum: Number(rates.platinumPrice || rates.platinum || 0),
        })
      } catch {
        // Keep fallback values if endpoint is unavailable.
      }
    }
    fetchMetalRates()
    return () => { mounted = false }
  }, [])

  // Sync active tab from URL search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam) {
      if (tabParam.startsWith('erp-')) {
        setActiveTab('erp')
        setErpSubTab(tabParam.replace('erp-', ''))
      } else {
        setActiveTab(tabParam)
      }
    }
  }, [])

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

  const headerGoldPrice = Number(latestMetalRates?.goldPrice || goldPrice || 0)
  const headerSilverPrice = Number(latestMetalRates?.silverPrice || silverPrice || 0)
  const headerPlatinumPrice = Number(latestMetalRates?.platinumPrice || platinumPrice || 0)
  const headerPalladiumPrice = Number(latestMetalRates?.palladiumPrice || palladiumPrice || 0)
  const headerMetalRatesUpdatedAt = latestMetalRates?.updatedAt || metalRatesUpdatedAt || null

  const handleLogout = () => { logout(); navigate('/login') }

  const metalOptions = [
    { key: 'gold', label: 'Gold', color: '#FACC15' },
    { key: 'silver', label: 'Silver', color: '#D1D5DB' },
    { key: 'platinum', label: 'Platinum', color: '#9CA3AF' },
  ]
  const selectedMetalOption = metalOptions.find((m) => m.key === selectedMetal) || metalOptions[0]
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'var(--grad-brand)' }}>
              <span style={{ color: 'white', fontWeight: 700, letterSpacing: 0.4 }}>{branding.logoText}</span>
            </div>
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

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(1px)' }}
          onClick={closeSidebar} />
      )}

      {/* ══════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════ */}
      <div className="flex-1 w-full h-full flex flex-col min-w-0 transition-all duration-300">

        {/* Top header bar */}
        <header className="topbar sticky top-0 z-30 flex-shrink-0">
          <div className="flex w-full items-center justify-between gap-10">
            <div className="flex items-center gap-3">
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
              <div>
                <h1 className="topbar-title">
                  {currentTab?.label || t('dashboard')}
                </h1>
                <p className="topbar-subtitle hidden sm:block">
                  {branding.displayName} | {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>

            {/* Right side of header */}
            <div className="ml-auto flex items-center justify-end gap-2 flex-nowrap">
              <BuildInfoBadge className="hidden md:inline-flex" />

              {/* Read-only badge */}
              {perms.isReadOnly && (
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                  🔒 {t('readOnly')}
                </span>
              )}

              {/* Metal price dropdown */}
              <div className="relative" ref={metalMenuRef}>
                <button
                  onClick={() => setMetalMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-sm transition-all"
                  style={{
                    background: metalMenuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: selectedMetalOption.color }} />
                  <span className="hidden lg:inline" style={{ fontWeight: 700, fontSize: 12 }}>{selectedMetalOption.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>
                    {Number(metalRates[selectedMetal] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5, marginTop: 1 }}>
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {metalMenuOpen && (
                  <div
                    className="absolute mt-1 py-1 rounded-xl shadow-2xl"
                    style={{
                      right: 0,
                      top: '100%',
                      minWidth: 200,
                      zIndex: 9999,
                      background: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    }}>
                    {metalOptions.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => { setSelectedMetal(m.key); setMetalMenuOpen(false) }}
                        className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm transition-all"
                        style={{
                          color: m.key === selectedMetal ? '#a78bfa' : 'rgba(255,255,255,0.88)',
                          background: m.key === selectedMetal ? 'rgba(139,92,246,0.15)' : 'transparent',
                          textAlign: 'left',
                        }}>
                        <span className="flex items-center gap-2">
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: m.color }} />
                          <span>{m.label}</span>
                        </span>
                        <span style={{ fontWeight: 700 }}>
                          {Number(metalRates[m.key] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification dropdown */}
              <div className="relative" ref={notifMenuRef}>
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="relative h-8 w-8 rounded-lg transition-all inline-flex items-center justify-center"
                  style={{
                    background: notifOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                  </svg>
                  {notifications.length > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontWeight: 700 }}>
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
                    {notifications.map((n) => (
                      <div key={n.id} style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.title}</p>
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
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-sm transition-all"
                  style={{
                    background: langMenuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.85 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9zM3 12a9 9 0 019-9 9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-9-9z" />
                  </svg>
                  <span className="hidden sm:inline font-semibold" style={{ fontSize: 12 }}>{languageCode} {langMeta.nativeLabel}</span>
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
                  className="flex items-center gap-2 px-2.5 h-8 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
                  <span
                    className="hidden lg:inline-flex items-center justify-center rounded px-1.5"
                    style={{
                      height: 18,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}>
                    {tenantShortCode}
                  </span>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
                    style={{ background: 'var(--grad-brand)' }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline text-sm" style={{ color: '#fff', fontWeight: 600 }}>{user?.name}</span>
                  <span
                    className="hidden xl:inline-flex items-center rounded px-1.5"
                    style={{
                      height: 18,
                      background: 'rgba(59,130,246,0.22)',
                      border: '1px solid rgba(96,165,250,0.4)',
                      color: '#93c5fd',
                      fontSize: 10,
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

              {/* Show ONLY on ERP Dashboard tab */}
              {activeTab === 'erp' && erpSubTab === 'dashboard' && (
                <>
                  {/* ── GOLD PRICE BADGE ── */}
                  <div className="relative right-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setShowMetalDropdown(prev => !prev)}
                      className="flex items-center gap-1.5 bg-gray-900 border border-yellow-500
                                 rounded-lg px-3 py-1.5 cursor-pointer text-yellow-500
                                 text-xs font-bold hover:bg-gray-800 transition-colors"
                    >
                      🥇 Gold
                      <span className="text-white font-semibold">
                        {headerGoldPrice > 0
                          ? `USD ${Number(headerGoldPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '---'}
                      </span>
                      <span className="text-gray-500 text-[9px]">▼</span>
                    </button>

                    {showMetalDropdown && (
                      <div className="absolute top-[110%] right-0 bg-gray-900 border border-gray-700
                                      rounded-xl p-4 min-w-[240px] z-[9999]
                                      shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                        <p className="text-[10px] text-gray-500 font-bold tracking-widest
                                       uppercase mb-3">
                          Live Metal Prices
                        </p>
                        {[
                          { label: 'Gold',      symbol: 'XAU', price: headerGoldPrice,      color: 'text-yellow-400', dot: 'bg-yellow-400' },
                          { label: 'Silver',    symbol: 'XAG', price: headerSilverPrice,    color: 'text-gray-300',   dot: 'bg-gray-400'   },
                          { label: 'Platinum',  symbol: 'XPT', price: headerPlatinumPrice,  color: 'text-blue-400',   dot: 'bg-blue-400'   },
                          { label: 'Palladium', symbol: 'XPD', price: headerPalladiumPrice, color: 'text-pink-400',   dot: 'bg-pink-400'   },
                        ].map(m => (
                          <div key={m.symbol}
                            className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                              <span className={`${m.color} font-bold text-xs`}>{m.label}</span>
                              <span className="text-gray-500 text-[10px]">{m.symbol}</span>
                            </div>
                            <span className="text-white font-bold text-xs">
                              {m.price && Number(m.price) > 0
                                ? `USD ${Number(m.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                : '---'}
                            </span>
                          </div>
                        ))}
                        <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center">
                          <span className="text-[9px] text-gray-600">Source: Live Feed</span>
                          <span className="text-[9px] text-gray-500">
                            {headerMetalRatesUpdatedAt
                              ? `Updated ${new Date(headerMetalRatesUpdatedAt).toLocaleString('en-US', {
                                  day: 'numeric', month: 'numeric', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}`
                              : 'Updates every 60s'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden' : 'p-6 overflow-y-auto'}`}
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          {renderTabContent(activeTab, setActiveTab, setChatUnread, erpSubTab, setLatestMetalRates)}
        </main>

      </div>
    </div>
  )
}

export default Dashboard
