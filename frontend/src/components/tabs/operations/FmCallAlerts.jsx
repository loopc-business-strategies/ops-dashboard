import { useCallback, useEffect, useRef, useState } from 'react'
import { mgFloorFmCallsApi } from '../../../api/mgFloorFmCalls'
import { OPS_C as C } from './operationsTabTokens'
import { B } from './operationsTabUI'

const POLL_MS = 10000
const BEEP_EVERY_MS = 4000

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function formatWhen(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Browsers keep an AudioContext suspended until the page has had a click or key press. */
function useAlarmSound() {
  const ctxRef = useRef(null)

  const getContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
    if (!AudioCtx) return null
    ctxRef.current = new AudioCtx()
    return ctxRef.current
  }, [])

  useEffect(() => {
    const unlock = () => {
      const ctx = getContext()
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      try { ctxRef.current?.close() } catch { /* ignore */ }
      ctxRef.current = null
    }
  }, [getContext])

  return useCallback(() => {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
      return
    }
    const start = ctx.currentTime
    ;[0, 0.28, 0.56].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = i === 1 ? 660 : 880
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.24)
    })
  }, [getContext])
}

/** Operations › FM: popup + repeating alarm while any "Call F.M" from the MG Floor tablet is still open. */
export default function FmCallAlerts({ showToast }) {
  const [calls, setCalls] = useState([])
  const [canAcknowledge, setCanAcknowledge] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const requestRef = useRef(0)
  const playAlarm = useAlarmSound()

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await mgFloorFmCallsApi.list()
      if (request !== requestRef.current) return
      setCalls(Array.isArray(res?.calls) ? res.calls : [])
      setCanAcknowledge(Boolean(res?.canAcknowledge))
    } catch {
      /* keep the last known calls; the next poll retries */
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearInterval(timer)
      requestRef.current += 1
    }
  }, [load])

  const ringing = calls.length > 0
  useEffect(() => {
    if (!ringing) return undefined
    playAlarm()
    const timer = setInterval(playAlarm, BEEP_EVERY_MS)
    return () => clearInterval(timer)
  }, [ringing, playAlarm])

  const acknowledge = async (call) => {
    if (busyId) return
    setBusyId(call._id)
    try {
      await mgFloorFmCallsApi.acknowledge(call._id)
      setCalls((prev) => prev.filter((c) => c._id !== call._id))
      showToast?.('Call acknowledged', `${call.metadata?.department || 'Floor'} · ${call.raisedByName || 'Operator'}`)
      await load()
    } catch (err) {
      showToast?.('Could not acknowledge', errorMessage(err, 'Acknowledge failed'))
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (!ringing) return null

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 84,
        right: 24,
        zIndex: 1000,
        width: 380,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        background: '#fff',
        border: `2px solid ${C.red}`,
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ background: C.red, color: '#fff', padding: '10px 14px', fontWeight: 800, fontSize: 14 }}>
        🔔 Call F.M — {calls.length} waiting
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {calls.map((call) => (
          <div key={call._id} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 800, color: C.t1, textTransform: 'capitalize' }}>
              {call.metadata?.department || 'Floor'}
            </div>
            <div style={{ fontSize: 12.5, color: C.t2, marginTop: 2 }}>
              {call.raisedByName || 'Operator'} · {formatWhen(call.createdAt)}
            </div>
            {call.message ? (
              <div style={{ fontSize: 12, color: C.t4, marginTop: 4 }}>{call.message}</div>
            ) : null}
            {canAcknowledge ? (
              <button
                type="button"
                className={`${B.danger} ${B.sm}`}
                disabled={busyId === call._id}
                onClick={() => acknowledge(call)}
                style={{ marginTop: 8 }}
              >
                {busyId === call._id ? 'Saving…' : 'Acknowledge'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
