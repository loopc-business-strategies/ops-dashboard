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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

// Import tab content components
import OverviewTab     from '../components/tabs/OverviewTab'
import AdminTab        from '../components/tabs/AdminTab'
import HRTab           from '../components/tabs/HRTab'
import FinanceTab      from '../components/tabs/FinanceTab'
import ProductionTab   from '../components/tabs/ProductionTab'
import ChatTab         from '../components/tabs/ChatTab'
import TrainingTab     from '../components/tabs/TrainingTab'
import OperationsTab   from '../components/tabs/OperationsTab'
import SalesTab        from '../components/tabs/SalesTab'
import PlaceholderTab  from '../components/tabs/PlaceholderTab'

// ── Role badge config ────────────────────────────
const ROLE_LABELS = {
  super_admin:     { label: 'Super Admin',  style: { color: 'var(--purple-light)', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' } },
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
function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      className={`sidebar-item${active ? ' active' : ''}`}>
      <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
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
    { id: 'overview',    icon: '▣',   label: 'Overview',            group: 'main',       show: true },
    { id: 'chat',        icon: '💬',  label: 'Chat',                group: 'main',       show: true, badge: chatUnread || null },

    // ── Admin (super_admin only) ──
    { id: 'admin',       icon: '🛡️',  label: 'Admin',               group: 'admin',      show: perms.isSuperAdmin },

    // ── Departments ──
    { id: 'hr',          icon: '👥',  label: 'HR',                  group: 'departments', show: perms.canViewModule('hr') },
    { id: 'compliance',  icon: '🏛️',  label: 'Compliance',          group: 'departments', show: perms.canViewModule('government') },
    { id: 'production',  icon: '🏭',  label: 'Production',          group: 'departments', show: perms.canViewModule('production') },
    { id: 'finance',     icon: '💰',  label: 'Finance',             group: 'departments', show: perms.canViewModule('finance') },
    { id: 'sales',       icon: '📈',  label: 'Sales',               group: 'departments', show: perms.canViewModule('sales') },
    { id: 'operations',  icon: '🚛',  label: 'Operations',          group: 'departments', show: perms.canViewModule('operations') },
    { id: 'training',    icon: '🎓',  label: 'Training',            group: 'departments', show: perms.canViewModule('training') },

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

    default:
      return (
        <div className="text-center py-20 text-gray-500">
          <p>Select a tab from the sidebar</p>
        </div>
      )
  }
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
  const [chatUnread,   setChatUnread]   = useState(3) // matches seed data initial unread

  const navItems = getNavItems(perms, chatUnread)

  // Group nav items
  const mainItems  = navItems.filter(n => n.group === 'main')
  const adminItems = navItems.filter(n => n.group === 'admin')
  const deptItems  = navItems.filter(n => n.group === 'departments')

  const handleLogout = () => { logout(); navigate('/login') }

  // Find current tab label
  const currentTab = navItems.find(n => n.id === activeTab)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>

      {/* ══════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════ */}
      <aside className={`
        sidebar fixed inset-y-0 left-0 z-50
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>

        {/* Sidebar top — logo */}
        <div className="sidebar-logo flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'var(--grad-brand)' }}>
              🏢
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">Ops Dashboard</p>
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
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }} />
          ))}

          {/* Admin section */}
          {adminItems.length > 0 && (
            <>
              <div className="sidebar-section-title">Admin</div>
              {adminItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }} />
              ))}
            </>
          )}

          {/* Departments */}
          {deptItems.length > 0 && (
            <>
              <div className="sidebar-section-title">Departments</div>
              {deptItems.map(item => (
                <NavItem key={item.id} {...item}
                  active={activeTab === item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }} />
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
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <RoleBadge role={user?.role} />
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
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
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top header bar */}
        <header className="topbar sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center justify-between gap-10">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Breadcrumb */}
              <div>
                <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {currentTab?.label || 'Dashboard'}
                </h1>
                <p className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
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
          {renderTab(activeTab, setActiveTab, setChatUnread)}
        </main>

      </div>
    </div>
  )
}

export default Dashboard
