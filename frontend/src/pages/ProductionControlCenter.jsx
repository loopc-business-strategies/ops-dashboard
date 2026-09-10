import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import productionControlApi from '../api/productionControl'
import { SECTIONS } from '../components/production-control/shared'
import LiveFloorPanel from '../components/production-control/LiveFloorPanel'
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
import './ProductionControlCenter.css'

const RETURN_KEY = 'pcc_returnTo'

export default function ProductionControlCenter() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, company } = useAuth()
  const [section, setSection] = useState('live')
  const [summary, setSummary] = useState(null)
  const [flow, setFlow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [live, setLive] = useState(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [floor, flowData] = await Promise.all([
        productionControlApi.getLiveFloor(),
        productionControlApi.getFlow(),
      ])
      setSummary(floor)
      setFlow(flowData.flow)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load production floor')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Subscribe to realtime production updates when socket.io client is available
  useEffect(() => {
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
        })
        socket.on('connect', () => {
          setLive(true)
          socket.emit('subscribe:tenant', company || undefined)
        })
        socket.on('disconnect', () => setLive(false))
        socket.on('production:update', () => {
          refresh()
        })
      } catch {
        setLive(false)
      }
    })()
    return () => {
      cancelled = true
      try { socket?.disconnect() } catch { /* ignore */ }
    }
  }, [company, refresh])

  const closeWorkspace = () => {
    const fromState = location.state?.returnTo
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(RETURN_KEY) : null
    const target = fromState || fromStorage || '/dashboard'
    if (fromStorage) sessionStorage.removeItem(RETURN_KEY)
    navigate(target)
  }

  const body = useMemo(() => {
    switch (section) {
      case 'overview':
        return (
          <OverviewPanel
            summary={summary}
            onSearch={(q) => productionControlApi.search(q)}
          />
        )
      case 'live':
        return (
          <LiveFloorPanel
            summary={summary}
            flow={flow}
            loading={loading}
            onSelectBatch={setSelectedBatchId}
            onRefresh={refresh}
          />
        )
      case 'batches':
        return <BatchesPanel onSelectBatch={setSelectedBatchId} onToast={showToast} />
      case 'movements':
        return <MovementsPanel />
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
        return <AuditPanel />
      default:
        return null
    }
  }, [section, summary, flow, loading, refresh, showToast])

  return (
    <div className="pcc-root">
      <header className="pcc-header">
        <div className="pcc-header-left">
          <h1>PRODUCTION CONTROL CENTER</h1>
          <span className="pcc-user">{user?.name || ''}</span>
        </div>
        <div className="pcc-header-right">
          <span className={`pcc-live ${live ? 'on' : ''}`}>
            <span className="pcc-live-dot" /> LIVE
          </span>
          <button type="button" className="pcc-close" onClick={closeWorkspace} aria-label="Close production">
            ✕ CLOSE
          </button>
        </div>
      </header>

      <nav className="pcc-nav" aria-label="Production sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id ? 'active' : ''}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
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
      />
    </div>
  )
}
