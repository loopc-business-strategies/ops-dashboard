/**
 * `fm`: MG Floor Manager approval tab, only for users the backend allows to approve. The same users
 * (Floor / Production Managers) also get the MG Floor attendance and loss limit tabs.
 * `mg`: MG-only Allocate tab (Post Mix → allocate + incoming receive Approve/Reject).
 */
export function getOpsTabs(t, { fm = null, floorOnly = false, mg = false } = {}) {
  const fmTabs = fm
    ? [
      { id: 'fm', label: fm.pending > 0 ? `FM (${fm.pending})` : 'FM' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'loss_limits', label: 'Loss limits' },
      { id: 'loss_report', label: 'Loss report' },
      { id: 'history', label: 'History' },
      { id: 'offline', label: 'Offline sync' },
    ]
    : []
  const allocateTab = mg ? [{ id: 'allocate', label: 'Allocate' }] : []
  if (floorOnly) return [{ id: 'production', label: 'Production' }, ...allocateTab, ...fmTabs]
  const tabs = [
    { id: 'production', label: 'Production' },
    ...allocateTab,
    { id: 'kpi', label: t('kpiOverview') },
    { id: 'checklist', label: t('readiness') },
    { id: 'supply', label: t('supplyChain') },
    { id: 'gold', label: t('goldSourcing') },
    { id: 'routes', label: t('transport') },
    { id: 'security', label: t('security') },
    { id: 'vendors', label: t('contracts') },
    { id: 'inventory', label: t('inventory') },
    { id: 'legal-docs', label: t('opsLegalDocuments') },
    { id: 'map', label: t('liveMap') },
    { id: 'analytics', label: t('analytics') },
    { id: 'projects', label: t('opsProjectsNav') },
  ]
  tabs.push(...fmTabs)
  return tabs
}

export function opsPct(v, t) {
  return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100)))
}
