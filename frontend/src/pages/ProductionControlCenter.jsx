import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DEPT_SECTION_MAP, SECTION_GROUPS, SECTION_IDS, SECTIONS, formatClock } from '../components/production-control/shared'
import { PccSkeleton } from '../components/production-control/primitives'
import { DemoModeProvider, useDemoMode } from '../components/production-control/demo/DemoModeContext'
import { isProductionDemoEnabled } from '../components/production-control/demo/flags'
import { usePccApi } from '../components/production-control/demo/usePccApi'
import './ProductionControlCenter.css'

const LiveFloorPanel = lazy(() => import('../components/production-control/LiveFloorPanel'))
const WorkOrdersPanel = lazy(() => import('../components/production-control/WorkOrdersPanel'))
const PlanningPanel = lazy(() => import('../components/production-control/PlanningPanel'))
const OverviewPanel = lazy(() => import('../components/production-control/panels/OverviewPanel'))
const BatchesPanel = lazy(() => import('../components/production-control/panels/BatchesPanel'))
const PassesPanel = lazy(() => import('../components/production-control/panels/PassesPanel'))
const MovementsPanel = lazy(() => import('../components/production-control/panels/MovementsPanel'))
const ProcessesPanel = lazy(() => import('../components/production-control/panels/ProcessesPanel'))
const QcPanel = lazy(() => import('../components/production-control/panels/QcPanel'))
const MachinesPanel = lazy(() => import('../components/production-control/panels/MachinesPanel'))
const AlertsPanel = lazy(() => import('../components/production-control/panels/AlertsPanel'))
const AuditPanel = lazy(() => import('../components/production-control/panels/AuditPanel'))
const BatchDetailModal = lazy(() => import('../components/production-control/panels/BatchDetailModal'))
const MyTasksPanel = lazy(() => import('../components/production-control/panels/MyTasksPanel'))
const StockOverviewPanel = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.StockOverviewPanel })),
)
const StockListPanel = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.StockListPanel })),
)
const NewStockInPanel = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.NewStockInPanel })),
)
const StockHistoryPanel = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.StockHistoryPanel })),
)
const StockAdjustmentsPanel = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.StockAdjustmentsPanel })),
)
const MarkAvailableHelper = lazy(() =>
  import('../components/production-control/StockPanels').then((m) => ({ default: m.MarkAvailableHelper })),
)
const DepartmentPanel = lazy(() => import('../components/production-control/DepartmentPanel'))
const FloorManagerPanel = lazy(() =>
  import('../components/production-control/FloorManagerPanels').then((m) => ({ default: m.FloorManagerPanel })),
)
const FloorAttendancePanel = lazy(() =>
  import('../components/production-control/FloorManagerPanels').then((m) => ({ default: m.FloorAttendancePanel })),
)
const ReportsPanel = lazy(() =>
  import('../components/production-control/FloorManagerPanels').then((m) => ({ default: m.ReportsPanel })),
)
const SettingsPanel = lazy(() =>
  import('../components/production-control/FloorManagerPanels').then((m) => ({ default: m.SettingsPanel })),
)
const MetalCustodyPanel = lazy(() =>
  import('../components/production-control/OpsPanels').then((m) => ({ default: m.MetalCustodyPanel })),
)
const DelayMonitorPanel = lazy(() =>
  import('../components/production-control/OpsPanels').then((m) => ({ default: m.DelayMonitorPanel })),
)
const ReworkQueuePanel = lazy(() =>
  import('../components/production-control/OpsPanels').then((m) => ({ default: m.ReworkQueuePanel })),
)
const MaintenancePanel = lazy(() =>
  import('../components/production-control/OpsPanels').then((m) => ({ default: m.MaintenancePanel })),
)
const DepartmentFlowPanel = lazy(() => import('../components/production-control/DepartmentFlowPanel'))

const RETURN_KEY = 'pcc_returnTo'
const DEMO_ENABLED = isProductionDemoEnabled()
const PROCESSING_STATUSES = 'ALLOCATED,UNDER_PROCESSING,DEPARTMENT_PROCESSING,QC_PENDING,QC_PASSED,QC_FAILED,REWORK,HOLD,PACKAGING'
const FLOOR_SUMMARY_SECTIONS = new Set(['live', 'overview', 'floor-manager', 'dept-flow'])
const FLOW_SECTIONS = new Set(['live', 'overview', 'settings', 'dept-flow', ...Object.keys(DEPT_SECTION_MAP)])

function connectionLabel(connection) {
  if (connection === 'LIVE') return 'Live data'
  if (connection === 'DEMO') return 'Demo data'
  if (connection === 'RECONNECTING') return 'Reconnecting…'
  return 'Offline — showing last available data'
}

function resolveSection(raw) {
  const id = String(raw || '').trim()
  return SECTION_IDS.has(id) ? id : 'live'
}

function SectionFallback() {
  return (
    <div className="pcc-panel">
      <PccSkeleton rows={5} />
    </div>
  )
}

function ProductionControlCenterInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, company } = useAuth()
  const { isDemo, enterDemo, exitDemo } = useDemoMode()
  const pccApi = usePccApi()

  const section = resolveSection(searchParams.get('section'))
  const setSection = useCallback((id) => {
    const next = resolveSection(id)
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('section', next)
      return p
    }, { replace: false })
  }, [setSearchParams])

  useEffect(() => {
    if (!searchParams.get('section') || !SECTION_IDS.has(String(searchParams.get('section')))) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set('section', 'live')
        return p
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const [summary, setSummary] = useState(null)
  const [flow, setFlow] = useState(null)
  const [productionRole, setProductionRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [connection, setConnection] = useState('OFFLINE')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [floorError, setFloorError] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHits, setSearchHits] = useState([])
  const sectionRef = useRef(section)
  const softTimerRef = useRef(null)
  const floorAbortRef = useRef(null)
  const searchWrapRef = useRef(null)

  sectionRef.current = section

  const sectionMeta = useMemo(
    () => SECTIONS.find((s) => s.id === section) || { id: section, label: section },
    [section],
  )
  const shiftLabel = summary?.currentShift?.name
    || summary?.currentShift?.label
    || null

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const mergeSummary = useCallback((part) => {
    setSummary((prev) => ({
      ...(prev || {}),
      ...part,
      kpis: { ...(prev?.kpis || {}), ...(part.kpis || {}) },
    }))
  }, [])

  const loadFloorProgressive = useCallback(async ({ soft = false } = {}) => {
    if (floorAbortRef.current) floorAbortRef.current.abort()
    const ac = new AbortController()
    floorAbortRef.current = ac
    if (!soft) setLoading(true)
    try {
      const summaryPart = await pccApi.getLiveFloorSummary({ signal: ac.signal })
      if (ac.signal.aborted) return
      mergeSummary(summaryPart)
      setLastUpdated(new Date())
      setFloorError(false)
      if (!soft) setLoading(false)

      const [board, widgets, alerts, custody, activity] = await Promise.all([
        pccApi.getLiveFloorBoard({ signal: ac.signal }),
        pccApi.getLiveFloorWidgets({ signal: ac.signal }),
        pccApi.getLiveFloorAlerts({ signal: ac.signal }),
        pccApi.getLiveFloorCustody({ signal: ac.signal }),
        pccApi.getLiveFloorActivity({ signal: ac.signal }),
      ])
      if (ac.signal.aborted) return
      mergeSummary({
        ...board,
        ...widgets,
        ...alerts,
        ...custody,
        ...activity,
        kpis: {
          ...(summaryPart.kpis || {}),
          ...(alerts.kpis || {}),
        },
      })
      setLastUpdated(new Date())
      setFloorError(false)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || ac.signal.aborted) return
      setFloorError(true)
      showToast(err?.response?.data?.message || 'Failed to load production floor')
    } finally {
      if (!soft && !ac.signal.aborted) setLoading(false)
    }
  }, [mergeSummary, pccApi, showToast])

  const refreshShell = useCallback(async () => {
    try {
      const needsFlow = FLOW_SECTIONS.has(sectionRef.current)
      const [meData, flowData] = await Promise.all([
        pccApi.me().catch(() => null),
        needsFlow ? pccApi.getFlow().catch(() => null) : Promise.resolve(null),
      ])
      if (meData?.productionRole) setProductionRole(meData.productionRole)
      if (flowData?.flow) setFlow(flowData.flow)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load production shell')
    }
  }, [pccApi, showToast])

  const refresh = useCallback(async ({ soft = false } = {}) => {
    const needsFloor = FLOOR_SUMMARY_SECTIONS.has(sectionRef.current) || Boolean(selectedBatchId)
    if (!soft) {
      await refreshShell()
    }
    if (needsFloor) {
      await loadFloorProgressive({ soft })
    } else if (!soft) {
      setLoading(false)
    }
  }, [loadFloorProgressive, refreshShell, selectedBatchId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await refreshShell()
      if (cancelled) return
      if (FLOOR_SUMMARY_SECTIONS.has(section)) {
        await loadFloorProgressive({ soft: false })
      } else {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      floorAbortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on demo toggle / section change handled below
  }, [isDemo])

  useEffect(() => {
    if (!FLOOR_SUMMARY_SECTIONS.has(section)) return undefined
    if (summary) return undefined
    loadFloorProgressive({ soft: false })
    return undefined
  }, [section, summary, loadFloorProgressive])

  useEffect(() => {
    if (FLOW_SECTIONS.has(section) && !flow) {
      pccApi.getFlow().then((d) => { if (d?.flow) setFlow(d.flow) }).catch(() => {})
    }
  }, [section, flow, pccApi])

  useEffect(() => {
    if (isDemo) {
      setConnection('DEMO')
      return undefined
    }
    let socket
    let cancelled = false
    ;(async () => {
      try {
        const { io } = await import('socket.io-client')
        const { API_ORIGIN } = await import('../api/client')
        if (cancelled) return
        socket = io(`${API_ORIGIN}/production`, {
          withCredentials: true,
          transports: ['websocket', 'polling'],
          auth: { token: 'browser-session' },
          reconnection: true,
          reconnectionAttempts: Infinity,
        })
        socket.on('connect', () => {
          setConnection('LIVE')
          socket.emit('subscribe:tenant', company || undefined)
        })
        socket.on('disconnect', () => setConnection('OFFLINE'))
        socket.io.on('reconnect_attempt', () => setConnection('RECONNECTING'))
        socket.io.on('reconnect', () => setConnection('LIVE'))
        socket.on('production:update', () => {
          if (!FLOOR_SUMMARY_SECTIONS.has(sectionRef.current) && !selectedBatchId) return
          if (softTimerRef.current) clearTimeout(softTimerRef.current)
          softTimerRef.current = setTimeout(() => {
            loadFloorProgressive({ soft: true })
          }, 300)
        })
      } catch {
        setConnection('OFFLINE')
      }
    })()
    return () => {
      cancelled = true
      if (softTimerRef.current) clearTimeout(softTimerRef.current)
      try { socket?.disconnect() } catch { /* ignore */ }
    }
  }, [company, isDemo, loadFloorProgressive, selectedBatchId])

  const closeWorkspace = () => {
    const fromState = location.state?.returnTo
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(RETURN_KEY) : null
    const target = fromState || fromStorage || '/dashboard'
    if (fromStorage) sessionStorage.removeItem(RETURN_KEY)
    navigate(target)
  }

  const runGlobalSearch = useCallback(async (e) => {
    e?.preventDefault?.()
    const q = String(globalQuery || '').trim()
    if (q.length < 1) return
    setSearchLoading(true)
    setSearchOpen(true)
    try {
      const data = await pccApi.search({ q })
      const batches = (data?.batches || []).map((b) => ({
        kind: 'batch',
        id: b._id,
        label: b.batchNumber || b._id,
        subtitle: [b.workOrderNumber, b.product || b.metalType, b.currentDepartment, b.status]
          .filter(Boolean)
          .join(' · '),
        batchId: b._id,
      }))
      const stockLots = (data?.stockLots || []).map((s) => ({
        kind: 'stock',
        id: s._id,
        label: s.stockCode || s.batchNumber || s._id,
        subtitle: [s.product, s.status, s.batchNumber].filter(Boolean).join(' · '),
        section: 'stock-overview',
      }))
      setSearchHits([...batches, ...stockLots].slice(0, 12))
    } catch {
      setSearchHits([])
      showToast('Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [globalQuery, pccApi, showToast])

  const openSearchHit = useCallback((hit) => {
    setSearchOpen(false)
    setGlobalQuery('')
    setSearchHits([])
    if (hit.batchId) {
      setSelectedBatchId(hit.batchId)
      return
    }
    if (hit.section) setSection(hit.section)
  }, [setSection])

  useEffect(() => {
    if (!searchOpen) return undefined
    const onDoc = (ev) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(ev.target)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [searchOpen])

  const connClass =
    connection === 'LIVE' || connection === 'DEMO' ? 'live'
      : connection === 'RECONNECTING' ? 'reconnecting'
        : 'offline'

  const body = useMemo(() => {
    if (DEPT_SECTION_MAP[section]) {
      return (
        <DepartmentPanel
          deptKey={DEPT_SECTION_MAP[section]}
          onToast={showToast}
          onSelectBatch={setSelectedBatchId}
        />
      )
    }

    switch (section) {
      case 'overview':
        return (
          <OverviewPanel
            summary={summary}
            flow={flow}
            loading={loading}
            error={floorError}
            onRetry={() => loadFloorProgressive({ soft: false })}
            onNavigate={setSection}
            onSelectBatch={setSelectedBatchId}
          />
        )
      case 'dept-flow':
        return (
          <DepartmentFlowPanel
            summary={summary}
            loading={loading}
            onNavigate={setSection}
            onRefresh={() => loadFloorProgressive({ soft: false })}
          />
        )
      case 'live':
        return (
          <LiveFloorPanel
            summary={summary}
            flow={flow}
            loading={loading}
            onSelectBatch={setSelectedBatchId}
            onRefresh={() => refresh()}
            onToast={showToast}
            onNavigate={setSection}
          />
        )
      case 'my-tasks':
        return (
          <MyTasksPanel
            onToast={showToast}
            onNavigate={setSection}
            onSelectBatch={setSelectedBatchId}
          />
        )
      case 'work-orders':
        return (
          <WorkOrdersPanel
            onToast={showToast}
            onOpenBatches={(wo) => {
              setSection('batches')
              showToast(wo?.woNumber ? `Opened batches — link WO ${wo.woNumber} when creating` : 'Opened batches')
            }}
          />
        )
      case 'planning':
        return (
          <PlanningPanel
            onToast={showToast}
            onOpenWorkOrders={() => setSection('work-orders')}
          />
        )
      case 'batches':
        return <BatchesPanel onSelectBatch={setSelectedBatchId} onToast={showToast} />
      case 'movements':
        return <MovementsPanel onToast={showToast} />
      case 'passes':
        return <PassesPanel onToast={showToast} productionRole={productionRole} />
      case 'processes':
        return <ProcessesPanel onToast={showToast} />
      case 'qc':
        return <QcPanel onToast={showToast} onNavigate={setSection} />
      case 'rework':
        return (
          <ReworkQueuePanel
            onToast={showToast}
            onSelectBatch={setSelectedBatchId}
            onNavigate={setSection}
          />
        )
      case 'metal-custody':
        return <MetalCustodyPanel onToast={showToast} onSelectBatch={setSelectedBatchId} />
      case 'delay-monitor':
        return <DelayMonitorPanel onToast={showToast} onSelectBatch={setSelectedBatchId} />
      case 'machines':
        return <MachinesPanel onToast={showToast} />
      case 'maintenance':
        return <MaintenancePanel onToast={showToast} />
      case 'alerts':
        return <AlertsPanel onToast={showToast} />
      case 'audit':
        return <AuditPanel onToast={showToast} />
      case 'stock-overview':
        return <StockOverviewPanel onToast={showToast} onNavigate={setSection} />
      case 'stock-in':
        return (
          <>
            <MarkAvailableHelper onToast={showToast} />
            <NewStockInPanel onToast={showToast} />
          </>
        )
      case 'stock-selection':
        return (
          <StockListPanel
            title="STOCK SELECTION — AVAILABLE"
            statusFilter="AVAILABLE"
            selectable
            onToast={showToast}
            onAllocated={() => loadFloorProgressive({ soft: true })}
          />
        )
      case 'stock-processing':
        return (
          <StockListPanel
            title="UNDER PROCESSING"
            statusFilter={PROCESSING_STATUSES}
            onToast={showToast}
          />
        )
      case 'stock-finished':
        return (
          <StockListPanel
            title="FINISHED STOCK"
            statusFilter="FINISHED,DISPATCHED"
            dispatchable
            onToast={showToast}
          />
        )
      case 'stock-history':
        return <StockHistoryPanel onToast={showToast} />
      case 'stock-adjustments':
        return <StockAdjustmentsPanel onToast={showToast} />
      case 'floor-manager':
        return (
          <FloorManagerPanel
            summary={summary}
            onToast={showToast}
            onNavigate={setSection}
          />
        )
      case 'floor-attendance':
        return <FloorAttendancePanel onToast={showToast} />
      case 'reports':
        return <ReportsPanel onToast={showToast} />
      case 'settings':
        return <SettingsPanel onToast={showToast} />
      default:
        return null
    }
  }, [section, summary, flow, loading, floorError, refresh, showToast, setSection, productionRole, loadFloorProgressive])

  return (
    <div className={`pcc-root${isDemo ? ' pcc-demo-active' : ''}`}>
      <header className="pcc-header">
        <div className="pcc-header-left">
          <span className="pcc-mark" aria-hidden="true" />
          <div className="pcc-header-titles">
            <h1>PRODUCTION CONTROL CENTER</h1>
            <span className="pcc-user">
              {[sectionMeta.label, shiftLabel ? `Shift ${shiftLabel}` : null, user?.name, company]
                .filter(Boolean)
                .join(' · ') || '—'}
            </span>
          </div>
          {isDemo && (
            <span className="pcc-demo-badge" title="Demo data only">DEMO MODE</span>
          )}
        </div>
        <div className="pcc-header-right">
          <div className="pcc-global-search" ref={searchWrapRef}>
            <form onSubmit={runGlobalSearch} className="pcc-global-search-form">
              <input
                type="search"
                className="pcc-global-search-input"
                placeholder="Search batch, WO, stock…"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onFocus={() => { if (searchHits.length) setSearchOpen(true) }}
                aria-label="Search production"
              />
              <button type="submit" className="pcc-btn-ghost" disabled={searchLoading}>
                {searchLoading ? '…' : 'Search'}
              </button>
            </form>
            {searchOpen && (
              <div className="pcc-global-search-results" role="listbox">
                {searchHits.length === 0 && !searchLoading ? (
                  <div className="pcc-global-search-empty">No matches</div>
                ) : null}
                {searchHits.map((hit) => (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    className="pcc-global-search-hit"
                    onClick={() => openSearchHit(hit)}
                  >
                    <strong>{hit.label}</strong>
                    <span>{hit.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="pcc-last-updated">
            {lastUpdated
              ? `Last successful update: ${formatClock(lastUpdated)}`
              : 'Last successful update: —'}
          </span>
          <span className={`pcc-live ${connClass}`}>
            <span className="pcc-live-dot" /> {connectionLabel(connection)}
          </span>
          <button type="button" className="pcc-btn-ghost" onClick={() => refresh()} aria-label="Refresh production data">
            Refresh
          </button>
          {DEMO_ENABLED && !isDemo && (
            <button type="button" className="pcc-btn" onClick={() => { enterDemo(); showToast('Demo mode — no production records are modified') }}>
              Demo View
            </button>
          )}
          {isDemo && (
            <button type="button" className="pcc-btn-ghost" onClick={() => { exitDemo(); showToast('Exited demo — showing live production data') }}>
              Exit Demo
            </button>
          )}
          <button type="button" className="pcc-close" onClick={closeWorkspace} aria-label="Close production">
            ✕ CLOSE
          </button>
        </div>
      </header>

      {isDemo && (
        <div className="pcc-demo-banner" role="status">
          Demo data only — no production records are being modified.
        </div>
      )}

      <nav className="pcc-nav" aria-label="Production sections">
        {SECTION_GROUPS.map((group) => (
          <div key={group.id} className="pcc-nav-group">
            <span className="pcc-nav-group-label">{group.label}</span>
            <div className="pcc-nav-group-items">
              {group.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={section === s.id ? 'active' : ''}
                  onClick={() => setSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <main className="pcc-main">
        <Suspense fallback={<SectionFallback />}>
          {body}
        </Suspense>
      </main>

      {toast && <div className="pcc-toast">{toast}</div>}

      {selectedBatchId && (
        <Suspense fallback={null}>
          <BatchDetailModal
            batchId={selectedBatchId}
            onClose={() => setSelectedBatchId(null)}
            onToast={showToast}
            onRefreshFloor={() => loadFloorProgressive({ soft: true })}
          />
        </Suspense>
      )}
    </div>
  )
}

export default function ProductionControlCenter() {
  // DemoModeProvider stays light; demoApi/productionDemoData load only after Demo View.
  return (
    <DemoModeProvider>
      <ProductionControlCenterInner />
    </DemoModeProvider>
  )
}
