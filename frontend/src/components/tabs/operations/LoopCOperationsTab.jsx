import { lazy, Suspense, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { ErpSubTabButton, ModuleSubTabRow, ModuleTabColumn } from '../../layout/ModuleTabChrome'
import { useDashboardModuleSubTab } from '../../../hooks/useDashboardModuleSubTab'

const LoopCProductionSheets = lazy(() => import('./LoopCProductionSheets'))
const SalesTab = lazy(() => import('../SalesTab'))
const HRTab = lazy(() => import('../HRTab'))
const ProcurementPlusTab = lazy(() => import('../ProcurementPlusTab'))

const LOOPC_OPS_TABS = [
  { id: 'production', label: 'Production' },
  { id: 'sales', label: 'Sales' },
  { id: 'hr', label: 'HR' },
  { id: 'procurement', label: 'Procurement' },
]

const ACTIVE_STYLE = {
  background: 'var(--brand-primary, #166534)',
  color: '#FFFFFF',
  border: '1px solid var(--brand-primary, #166534)',
  fontWeight: 700,
  borderRadius: '0.5rem',
  padding: '0.55rem 1rem',
}

const IDLE_STYLE = {
  background: '#FFFFFF',
  color: '#0F172A',
  border: '1px solid #CBD5E1',
  fontWeight: 600,
  borderRadius: '0.5rem',
  padding: '0.55rem 1rem',
}

function Fallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

/**
 * LoopC-only Operations workspace: Production sheets + Sales / HR / Procurement.
 * Does not wipe backend data — replaces Operations UI only.
 */
export default function LoopCOperationsTab() {
  const { company } = useAuth()
  const allowedSubIds = useMemo(() => LOOPC_OPS_TABS.map((t) => t.id), [])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'operations',
    allowedSubIds,
    'production',
    company,
  )

  return (
    <ModuleTabColumn>
      <ModuleSubTabRow>
        {LOOPC_OPS_TABS.map(({ id, label }) => {
          const active = id === activeTab
          return (
            <ErpSubTabButton
              key={id}
              active={active}
              href={buildSubHref(id)}
              onClick={(event) => handleSubTabClick(id, event)}
              style={active ? ACTIVE_STYLE : IDLE_STYLE}
            >
              {label}
            </ErpSubTabButton>
          )
        })}
      </ModuleSubTabRow>

      {activeTab === 'production' && (
        <Suspense fallback={<Fallback />}>
          <LoopCProductionSheets />
        </Suspense>
      )}
      {activeTab === 'sales' && (
        <Suspense fallback={<Fallback />}>
          <SalesTab embedded />
        </Suspense>
      )}
      {activeTab === 'hr' && (
        <Suspense fallback={<Fallback />}>
          <HRTab embedded />
        </Suspense>
      )}
      {activeTab === 'procurement' && (
        <Suspense fallback={<Fallback />}>
          <ProcurementPlusTab embedded />
        </Suspense>
      )}
    </ModuleTabColumn>
  )
}
