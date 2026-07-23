// FILE: src/components/tabs/ProductionTab.jsx
// Production Control Center — 9 sub-tabs, role-based access

import { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'
import { ErpSubTabButton, ModulePageHeading, ModuleSubTabRow, ModuleTabColumn } from '../layout/ModuleTabChrome'
import {
  USE_SEED_DATA,
  getProductionTabs,
  Toast,
  linesForUi,
  DEFAULT_ALERTS,
  NOTIFICATIONS_DATA,
} from './production/shared'
import KPIOverview from './production/KPIOverview'
import LiveMonitor from './production/LiveMonitor'
import Equipment from './production/Equipment'
import Maintenance from './production/Maintenance'
import QualityControl from './production/QualityControl'
import ShiftManagement from './production/ShiftManagement'
import Planning from './production/Planning'
import AlertsReports from './production/AlertsReports'
import CostTracking from './production/CostTracking'
import NotificationsPanel from './production/NotificationsPanel'

export default function ProductionTab() {
  const { user, company } = useAuth()
  const { isSuperAdmin, isManagement, isDepartmentHead, isReadOnly } = usePermissions()
  const { t } = useLanguage()
  const SUB_TABS = useMemo(() => getProductionTabs(t), [t])
  const allowedSubIds = useMemo(() => SUB_TABS.map((tab) => tab.id), [SUB_TABS])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'production',
    allowedSubIds,
    'kpi',
    company,
  )

  const [toast, setToast] = useState(null)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [notifications, setNotifications] = useState(USE_SEED_DATA ? NOTIFICATIONS_DATA : [])
  const [notifFilter, setNotifFilter]     = useState('all')

  // Edit access: super_admin and department_head can edit all production modules.
  // department_user can edit most operational tabs but not KPI/Cost.
  const deptUserEditableTabs = ['monitor', 'equipment', 'maintenance', 'quality', 'shifts', 'planning', 'alerts']
  const canEdit = isSuperAdmin || isDepartmentHead || (user?.role === 'department_user' && deptUserEditableTabs.includes(activeTab))
  // Cost Tracking: only super_admin and management (finance/exec level)
  const canViewCosts = isSuperAdmin || isManagement

  // Map dashboard role → production notification roles
  const prodRoles = isSuperAdmin ? null
    : isManagement   ? ['superadmin', 'prod_mgr', 'finance']
    : isDepartmentHead ? ['superadmin', 'prod_mgr', 'shift_sup']
    : ['operator', 'shift_sup', 'quality', 'maint_eng']

  const roleNotifs   = prodRoles === null ? notifications : notifications.filter(n => n.roles.some(r => prodRoles.includes(r)))
  const unreadCount  = roleNotifs.filter(n => !n.read).length

  const acknowledgeNotif = id => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true, acked: true } : n))
  const dismissNotif     = id => setNotifications(p => p.filter(n => n.id !== id))
  const escalateNotif    = id => {
    acknowledgeNotif(id)
    showToast('Alert Escalated', 'Notification escalated to Production Manager.')
  }

  const showToast = (title, msg) => {
    setToast({ title, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const renderTab = () => {
    const props = { canEdit, showToast }
    switch (activeTab) {
      case 'kpi':         return <KPIOverview />
      case 'monitor':     return <LiveMonitor {...props} />
      case 'equipment':   return <Equipment {...props} />
      case 'maintenance': return <Maintenance {...props} />
      case 'quality':     return <QualityControl {...props} />
      case 'shifts':      return <ShiftManagement {...props} />
      case 'planning':    return <Planning {...props} />
      case 'alerts':      return <AlertsReports {...props} />
      case 'costs':       return <CostTracking canViewCosts={canViewCosts} />
      default:            return null
    }
  }

  return (
    <>
    <ModuleTabColumn>
      <ModulePageHeading
        title="Production Control Center"
        subtitle={`${linesForUi.filter((l) => l.state === 'running').length} lines running${USE_SEED_DATA ? ` · ${DEFAULT_ALERTS.filter((a) => !a.ack).length} active alerts` : ''}`}
        right={(
          <div className="flex items-center gap-3">
            {isReadOnly && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs font-medium">
                🔒 Read-only view
              </div>
            )}
            <div className="notif-bell" onClick={() => setNotifOpen(true)} title={`${unreadCount} unread notifications`}>
              🔔
              {unreadCount > 0 && (
                <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </div>
          </div>
        )}
      />

      <ModuleSubTabRow>
        {SUB_TABS.map((tab) => (
          <ErpSubTabButton
            key={tab.id}
            active={activeTab === tab.id}
            href={buildSubHref(tab.id)}
            onClick={(event) => handleSubTabClick(tab.id, event)}
          >
            {tab.label}
          </ErpSubTabButton>
        ))}
      </ModuleSubTabRow>

      <div className="min-h-[400px]">
        {renderTab()}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </ModuleTabColumn>

    <NotificationsPanel
      open={notifOpen}
      onClose={() => setNotifOpen(false)}
      notifications={roleNotifs}
      onAcknowledge={acknowledgeNotif}
      onEscalate={escalateNotif}
      onDismiss={dismissNotif}
      onMarkAllRead={() => setNotifications(p => p.map(n => ({ ...n, read: true })))}
      onClearRead={() => setNotifications(p => p.filter(n => !n.read))}
      filter={notifFilter}
      onFilterChange={setNotifFilter}
    />
    </>
  )
}

