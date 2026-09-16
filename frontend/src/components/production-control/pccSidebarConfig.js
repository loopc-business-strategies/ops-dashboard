/** Sidebar presentation for PCC — references existing SECTION_IDS only. */

export const STOCK_SECTION_IDS = [
  'stock-overview',
  'stock-in',
  'stock-selection',
  'stock-processing',
  'stock-finished',
  'stock-history',
  'stock-adjustments',
]

export const STOCK_WORKSPACE_TABS = [
  { id: 'stock-overview', label: 'Overview' },
  { id: 'stock-selection', label: 'Available' },
  { id: 'stock-processing', label: 'Under Processing' },
  { id: 'stock-finished', label: 'Finished' },
  { id: 'stock-history', label: 'History' },
  { id: 'stock-adjustments', label: 'Adjustments' },
]

/** Primary sidebar IA. Nested `children` expand under Departments. */
export const PCC_SIDEBAR_GROUPS = [
  {
    id: 'command',
    label: 'COMMAND',
    items: [
      { id: 'live', label: 'Live Floor' },
      { id: 'overview', label: 'Overview' },
      { id: 'my-tasks', label: 'My Tasks' },
      { id: 'alerts', label: 'Alerts' },
      { id: 'delay-monitor', label: 'Delays' },
    ],
  },
  {
    id: 'production',
    label: 'PRODUCTION',
    items: [
      { id: 'work-orders', label: 'Work Orders' },
      { id: 'planning', label: 'Planning' },
      { id: 'batches', label: 'Batches' },
      { id: 'processes', label: 'Processes' },
      { id: 'dept-flow', label: 'Production Flow' },
    ],
  },
  {
    id: 'material',
    label: 'MATERIAL',
    items: [
      { id: 'stock-overview', label: 'Stock', stockHub: true },
      { id: 'movements', label: 'Metal Movement' },
      { id: 'passes', label: 'Handovers' },
      { id: 'metal-custody', label: 'Metal Custody' },
    ],
  },
  {
    id: 'quality',
    label: 'QUALITY',
    items: [
      { id: 'qc', label: 'QC' },
      { id: 'rework', label: 'Rework' },
    ],
  },
  {
    id: 'factory',
    label: 'FACTORY',
    items: [
      {
        id: 'dept-flow',
        label: 'Departments',
        children: [
          { id: 'dept-melting', label: 'Melting' },
          { id: 'dept-casting', label: 'Casting' },
          { id: 'dept-rolling', label: 'Rolling' },
          { id: 'dept-bangle_division', label: 'Bangle Division' },
          { id: 'dept-stamping', label: 'Stamping' },
          { id: 'dept-polishing', label: 'Polishing' },
          { id: 'dept-quality_control', label: 'Quality Control' },
          { id: 'dept-packing', label: 'Packaging' },
        ],
      },
      { id: 'machines', label: 'Machines' },
      { id: 'maintenance', label: 'Maintenance' },
      { id: 'floor-manager', label: 'Floor Manager' },
      { id: 'floor-attendance', label: 'Floor Attendance' },
    ],
  },
  {
    id: 'reporting',
    label: 'REPORTS',
    items: [
      { id: 'reports', label: 'Reports' },
      { id: 'audit', label: 'Audit' },
    ],
  },
  {
    id: 'admin',
    label: 'ADMIN',
    items: [
      { id: 'settings', label: 'Settings' },
    ],
  },
]

export function isStockSection(sectionId) {
  return STOCK_SECTION_IDS.includes(String(sectionId || ''))
}

export function isSidebarItemActive(sectionId, item) {
  const sid = String(sectionId || '')
  if (item.stockHub) return isStockSection(sid)
  if (item.children?.length) {
    if (sid === item.id) return true
    return item.children.some((c) => c.id === sid)
  }
  return sid === item.id
}
