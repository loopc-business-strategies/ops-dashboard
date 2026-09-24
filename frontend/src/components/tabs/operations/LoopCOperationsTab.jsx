import { lazy, Suspense, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { ErpSubTabButton, ModuleSubTabRow, ModuleTabColumn } from '../../layout/ModuleTabChrome'
import { useDashboardModuleSubTab } from '../../../hooks/useDashboardModuleSubTab'

const ProductionDashboardTab = lazy(() => import('../../production-dashboard/ProductionDashboardTab'))
const SalesTab = lazy(() => import('../SalesTab'))
const HRTab = lazy(() => import('../HRTab'))
const ProcurementPlusTab = lazy(() => import('../ProcurementPlusTab'))

const LOOPC_OPS_TABS = [
  { id: 'production', label: 'Production', Icon: IconFactory },
  { id: 'sales', label: 'Sales', Icon: IconBag },
  { id: 'hr', label: 'HR', Icon: IconUsers },
  { id: 'procurement', label: 'Procurement', Icon: IconCart },
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

function IconFactory({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 20h20" />
      <path d="M5 20V10l5 3V10l5 3V6h4v14" />
    </svg>
  )
}

function IconBag({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function IconUsers({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCart({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
    </svg>
  )
}

function Fallback() {
  return (
    <div style={{ padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>
      Loading…
    </div>
  )
}

/**
 * LoopC-only Operations workspace: Production / Sales / HR / Procurement.
 * Reuses existing modules; does not wipe backend data.
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
        {LOOPC_OPS_TABS.map(({ id, label, Icon }) => {
          const active = id === activeTab
          return (
            <ErpSubTabButton
              key={id}
              active={active}
              href={buildSubHref(id)}
              onClick={(event) => handleSubTabClick(id, event)}
              style={active ? ACTIVE_STYLE : IDLE_STYLE}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon size={14} />
                {label}
              </span>
            </ErpSubTabButton>
          )
        })}
      </ModuleSubTabRow>

      {activeTab === 'production' && (
        <Suspense fallback={<Fallback />}>
          <ProductionDashboardTab />
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
