export function getOpsTabs(t) {
  return [
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
}

export function opsPct(v, t) {
  return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100)))
}
