import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SECTION_GROUPS, SECTION_IDS, formatTime } from '../components/production-control/shared'
import LiveFloorPanel from '../components/production-control/LiveFloorPanel'
import WorkOrdersPanel from '../components/production-control/WorkOrdersPanel'
import {
  OverviewPanel,
  BatchesPanel,
  PassesPanel,
  MovementsPanel,
  ProcessesPanel,
  QcPanel,
  MachinesPanel,
  AlertsPanel,
  AuditPanel,
  BatchDetailModal,
} from '../components/production-control/Panels'
import { DemoModeProvider, useDemoMode } from '../components/production-control/demo/DemoModeContext'
import { isProductionDemoEnabled } from '../components/production-control/demo/flags'
import { usePccApi } from '../components/production-control/demo/usePccApi'
import './ProductionControlCenter.css'

const RETURN_KEY = 'pcc_returnTo'
const DEMO_ENABLED = isProductionDemoEnabled()

function resolveSection(raw) {
  const id = String(raw || '').trim()
  return SECTION_IDS.has(id) ? id : 'live'
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
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [connection, setConnection] = useState('OFFLINE')
  const [lastUpdated, setLastUpdated] = useState(null)
  const refreshFloorOnly = useRef(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const refresh = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true)
    try {
      if (soft && refreshFloorOnly.current) {
        const floor = await pccApi.getLiveFloor()
        setSummary(floor)
        setLastUpdated(new Date())
        return
      }
      const [floor, flowData] = await Promise.all([
        pccApi.getLiveFloor(),
        pccApi.getFlow(),
      ])
      setSummary(floor)
      setFlow(flowData.flow)
      setLastUpdated(new Date())
      refreshFloorOnly.current = true
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load production floor')
    } finally {
      if (!soft) setLoading(false)
    }
  }, [pccApi, showToast])

  useEffect(() => {
    refreshFloorOnly.current = false
    refresh()
  }, [refresh, isDemo])

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
          refresh({ soft: true })
        })
      } catch {
        setConnection('OFFLINE')
      }
    })()
    return () => {
      cancelled = true
      try { socket?.disconnect() } catch { /* ignore */ }
    }
  }, [company, refresh, isDemo])

  const closeWorkspace = () => {
    const fromState = location.state?.returnTo
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(RETURN_KEY) : null
    const target = fromState || fromStorage || '/dashboard'
    if (fromStorage) sessionStorage.removeItem(RETURN_KEY)
    navigate(target)
  }

  const connClass =
    connection === 'LIVE' || connection === 'DEMO' ? 'live'
      : connection === 'RECONNECTING' ? 'reconnecting'
        : 'offline'

  const body = useMemo(() => {
    switch (section) {
      case 'overview':
        return (
          <OverviewPanel
            summary={summary}
            onSearch={(q) => pccApi.search(q)}
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
      case 'batches':
        return <BatchesPanel onSelectBatch={setSelectedBatchId} onToast={showToast} />
      case 'movements':
        return <MovementsPanel onToast={showToast} />
      case 'passes':
        return <PassesPanel onToast={showToast} />
      case 'processes':
        return <ProcessesPanel onToast={showToast} />
      case 'qc':
        return <QcPanel onToast={showToast} />
      case 'machines':
        return <MachinesPanel onToast={showToast} />
      case 'alerts':
        return <AlertsPanel onToast={showToast} />
      case 'audit':
        return <AuditPanel onToast={showToast} />
      default:
        return null
    }
  }, [section, summary, flow, loading, refresh, showToast, pccApi, setSection])

  return (
    <div className={`pcc-root${isDemo ? ' pcc-demo-active' : ''}`}>
      <header className="pcc-header">
        <div className="pcc-header-left">
          <span className="pcc-mark" aria-hidden="true" />
          <div className="pcc-header-titles">
            <h1>PRODUCTION CONTROL CENTER</h1>
            <span className="pcc-user">
              {[user?.name, company].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
          {isDemo && (
            <span className="pcc-demo-badge" title="Demo data only">DEMO MODE</span>
          )}
        </div>
        <div className="pcc-header-right">
          {lastUpdated && (
            <span className="pcc-last-updated">Updated {formatTime(lastUpdated)}</span>
          )}
          <span className={`pcc-live ${connClass}`}>
            <span className="pcc-live-dot" /> {connection}
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
        {body}
      </main>

      {toast && <div className="pcc-toast">{toast}</div>}

      <BatchDetailModal
        batchId={selectedBatchId}
        onClose={() => setSelectedBatchId(null)}
        onToast={showToast}
        onRefreshFloor={() => refresh({ soft: true })}
      />
    </div>
  )
}

export default function ProductionControlCenter() {
  return (
    <DemoModeProvider>
      <ProductionControlCenterInner />
    </DemoModeProvider>
  )
}
