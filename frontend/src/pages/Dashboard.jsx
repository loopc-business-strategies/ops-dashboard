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

import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

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
const ROLE_LABELS = {
  super_admin:     { label: 'Super Admin',  style: { color: '#00684A', background: 'rgba(0,104,74,0.1)', border: '1px solid rgba(0,104,74,0.3)' } },
  management:      { label: 'Management',   style: { color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' } },
  department_head: { label: 'Dept. Head',   style: { color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' } },
  department_user: { label: 'Dept. User',   style: { color: 'var(--text-secondary)', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' } },
  external:        { label: 'External',     style: { color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' } },
}

function RoleBadge({ role }) {
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
// To ADD a new tab later:
//   1. Add an entry here
//   2. Add a case in the renderTab() function below
function getNavItems(perms, chatUnread = 0) {
  return [
    // ── Main ──
    { id: 'overview',    label: 'Overview',            group: 'main',       show: true },
    { id: 'chat',        label: 'Chat',                group: 'main',       show: true, badge: chatUnread || null },

    // ── Admin (super_admin only) ──
    { id: 'admin',       label: 'Admin',               group: 'admin',      show: perms.isSuperAdmin },

    // ── Departments ──
    { id: 'hr',          label: 'HR',                  group: 'departments', show: perms.canViewModule('hr') },
    { id: 'compliance',  label: 'Compliance',          group: 'departments', show: perms.canViewModule('government') },
    { id: 'production',  label: 'Production',          group: 'departments', show: perms.canViewModule('production') },
    { id: 'finance',     label: 'Finance',             group: 'departments', show: perms.canViewModule('finance') },
    { id: 'sales',       label: 'Sales',               group: 'departments', show: perms.canViewModule('sales') },
    { id: 'operations',  label: 'Operations',          group: 'departments', show: perms.canViewModule('operations') },
    { id: 'training',    label: 'Training',            group: 'departments', show: perms.canViewModule('training') },
    { id: 'erp',         label: 'ERP',                 group: 'departments', show: !perms.isExternal },

    // ── More tabs added here as client requests ──
    // { id: 'reports',  icon: '📊', label: 'Reports', group: 'more', show: true },
  ].filter(n => n.show)
}

// ── Render the content for each tab ────────────
function renderTab(tabId, setActiveTab, setChatUnread) {
  switch (tabId) {
    case 'overview':
      return <OverviewTab onNavigate={setActiveTab} />

    case 'chat':
      return <ChatTab onUnreadChange={setChatUnread} />

    case 'admin':
      return <AdminTab />

    case 'hr':
      return <HRTab />

    case 'compliance':
      return (
        <PlaceholderTab
          title="Government & Compliance"
          icon="🏛️"
          description="Track regulatory approvals, documentation, and compliance status"
          subTabs={['Eligibility Status', 'Approvals Tracker', 'Documentation', 'Regulatory Updates', 'Agreements']}
        />
      )

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
      return <ERPTab />

    default:
      return (
        <div className="text-center py-20 text-gray-500">
          <p>Select a tab from the sidebar</p>
        </div>
      )
  }
}

function renderTabContent(tabId, setActiveTab, setChatUnread) {
  return (
    <TabErrorBoundary resetKey={tabId}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTab(tabId, setActiveTab, setChatUnread)}
      </Suspense>
    </TabErrorBoundary>
  )
}

// ══════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════
function Dashboard() {
  const { user, logout } = useAuth()
  const perms = usePermissions()
  const navigate = useNavigate()

  const [activeTab,    setActiveTab]    = useState('overview')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [adminOpen,    setAdminOpen]    = useState(true)
  const [deptOpen,     setDeptOpen]     = useState(true)
  const [chatUnread,   setChatUnread]   = useState(3) // matches seed data initial unread

  const EDGE_TRIGGER_WIDTH = 20
  const SIDEBAR_WIDTH = 240
  const HIDE_DELAY_MS = 400
  const HIDE_THRESHOLD_X = 320
  const hideTimerRef = useRef(null)

  const navItems = getNavItems(perms, chatUnread)

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

  const handleLogout = () => { logout(); navigate('/login') }

  // Find current tab label
  const currentTab = navItems.find(n => n.id === activeTab)

  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }} onMouseMove={handleShellMouseMove}>

      {/* Desktop edge sensor: reveal sidebar when mouse nears left edge */}
      {!sidebarOpen && (
        <div
          className="fixed inset-y-0 left-0 z-40"
          style={{ width: EDGE_TRIGGER_WIDTH }}
          onMouseEnter={openSidebar}
        />
      )}

      {/* ══════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════ */}
      <aside className={`
        sidebar fixed inset-y-0 left-0 z-50
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      onMouseEnter={clearHideTimer}
      onMouseLeave={queueHideSidebar}>

        {/* Sidebar top — logo */}
        <div className="sidebar-logo flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'var(--grad-brand)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18.6 4.8C14.9 4.8 11.9 6.2 9.9 8.4C7.7 10.8 6.9 14.1 7.4 18.1C11.4 18.6 14.7 17.8 17.1 15.6C19.3 13.6 20.7 10.6 20.7 6.9V4.8H18.6Z" fill="rgba(255,255,255,0.95)"/>
                <path d="M4.5 19.5C7.5 16.6 10.2 14.9 13.5 13.4" stroke="rgba(255,255,255,0.95)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: '#1C2A33' }}>Ops Dashboard</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>Control System</p>
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
                <span>Admin</span>
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
                <span>Departments</span>
                <span className="section-chevron">{deptOpen ? '▴' : '▾'}</span>
              </button>
              {deptOpen && deptItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)} />
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
              <RoleBadge role={user?.role} />
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
            Sign out
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
      <div className={`h-full flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-[240px]' : 'lg:ml-0'}`}>

        {/* Top header bar */}
        <header className="topbar sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between gap-10">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
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
                  {currentTab?.label || 'Dashboard'}
                </h1>
                <p className="topbar-subtitle hidden sm:block">
                  {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>

            {/* Right side of header */}
            <div className="flex items-center gap-3">
              {/* Read-only badge for management/external */}
              {perms.isReadOnly && (
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                  🔒 Read Only
                </span>
              )}

              {/* Current user role — desktop */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
                  style={{ background: 'var(--grad-brand)' }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
                <RoleBadge role={user?.role} />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden' : 'p-6 overflow-y-auto'}`}
          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          {renderTabContent(activeTab, setActiveTab, setChatUnread)}
        </main>

      </div>
    </div>
  )
}

export default Dashboard
