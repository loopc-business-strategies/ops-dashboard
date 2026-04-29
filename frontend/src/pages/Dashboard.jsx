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

import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage, LANGUAGES } from '../context/LanguageContext'
import { getTenantBranding } from '../config/tenantBranding'

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

// ── Role badge config ────────────────────────────
function getRoleLabels(t) {
  return {
    super_admin:     { label: t('superAdmin'),  style: { color: 'var(--purple)', background: 'rgba(var(--purple-rgb),0.1)', border: '1px solid rgba(var(--purple-rgb),0.3)' } },
    management:      { label: t('management'),  style: { color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' } },
    department_head: { label: t('deptHead'),    style: { color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' } },
    department_user: { label: t('deptUser'),    style: { color: 'var(--text-secondary)', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' } },
    external:        { label: t('external'),    style: { color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' } },
  }
}

function RoleBadge({ role, t }) {
  const ROLE_LABELS = getRoleLabels(t)
  const cfg = ROLE_LABELS[role] || ROLE_LABELS.department_user
  return (
    <span style={{ ...cfg.style, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
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
  const langMenuRef = useRef(null)

  const EDGE_TRIGGER_WIDTH = 20
  const SIDEBAR_WIDTH = 240
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

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const openSidebar = () => {
    clearHideTimer()
    setSidebarOpen(true)
  }

  const queueHideSidebar = () => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      setSidebarOpen(false)
      hideTimerRef.current = null
    }, HIDE_DELAY_MS)
  }

  useEffect(() => {
    return () => clearHideTimer()
  }, [])

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

  const handleShellMouseMove = (e) => {
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

  // Group nav items
  const mainItems  = navItems.filter(n => n.group === 'main')
  const adminItems = navItems.filter(n => n.group === 'admin')
  const deptItems  = navItems.filter(n => n.group === 'departments')
  const erpItems   = navItems.filter(n => n.group === 'erp')

  const handleLogout = () => { logout(); navigate('/login') }

  // Find current tab label
  const currentTab = navItems.find(n => n.id === activeTab)

  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100vh' }} onMouseMove={handleShellMouseMove}>

      {/* Desktop edge sensor: reveal sidebar when mouse nears left/right edge */}
      {!sidebarOpen && (
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
        onMouseEnter={clearHideTimer}
        onMouseLeave={queueHideSidebar}>

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
              onClick={() => setActiveTab(item.id)} />
          ))}

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
                  onClick={() => setActiveTab(item.id)} />
              ))}
            </>
          )}

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
                  onClick={() => setActiveTab(item.id)} />
              ))}
            </>
          )}

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
                  onClick={() => { setActiveTab('erp'); setErpSubTab(item.erpSub) }} />
              ))}
            </>
          )}

        </nav>

        {/* Sidebar bottom — user info + logout */}
        <div className="sidebar-footer flex-shrink-0 inline">
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
              style={{ background: 'var(--grad-brand)' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-100px">
              <p className="text-sm font-medium truncate" style={{ color: '#1C2A33' }}>{user?.name}</p>
              <RoleBadge role={user?.role} t={t} />
            </div>
          </div>
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
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════ */}
      <div className={`flex-1 w-full h-full flex flex-col min-w-0 transition-all duration-300
        ${sidebarOpen ? (isRTL ? 'lg:mr-[240px]' : 'lg:ml-[240px]') : (isRTL ? 'lg:mr-0' : 'lg:ml-0')}`}>

        {/* Top header bar */}
        <header className="topbar sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between gap-10">
            <div className="flex items-center gap-3">
              {/* Hamburger */}
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
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
            <div className="flex items-center gap-3">
              {/* Read-only badge */}
              {perms.isReadOnly && (
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                  🔒 {t('readOnly')}
                </span>
              )}

              {/* ── Language Switcher ── */}
              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangMenuOpen(v => !v)}
                  title={t('language')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all"
                  style={{
                    background: langMenuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{langMeta.flag}</span>
                  <span className="hidden sm:inline font-medium" style={{ fontSize: 12 }}>{langMeta.nativeLabel}</span>
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

              {/* Current user role — desktop */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {branding.displayName}
                </span>
                <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
                  style={{ background: 'var(--grad-brand)' }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
                <RoleBadge role={user?.role} t={t} />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden' : 'p-6 overflow-y-auto'}`}
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          {renderTabContent(activeTab, setActiveTab, setChatUnread, erpSubTab)}
        </main>

      </div>
    </div>
  )
}

export default Dashboard
