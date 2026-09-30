import { useCallback, useEffect, useRef, useState } from 'react'
import { mgFloorFmCallsApi } from '../../api/mgFloorFmCalls'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'

const POLL_MS = 15000
const BEEP_EVERY_MS = 4000
export const FM_ALARM_MUTE_KEY = 'pd.fmAlarmMuted'

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function departmentLabel(key) {
  const text = String(key || '').replace(/_/g, ' ').trim()
  return text ? text.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Floor'
}

function formatWhen(value, now) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const clock = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const minutes = Math.max(0, Math.floor((now - d.getTime()) / 60000))
  return `${clock} · ${minutes < 1 ? 'just now' : `${minutes} min ago`}`
}

function readMuted() {
  try {
    return window.localStorage.getItem(FM_ALARM_MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** Browsers keep an AudioContext suspended until the page has had a click or key press. */
function useAlarmSound(onBlockedChange) {
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
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => onBlockedChange(false)).catch(() => {})
      }
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      try { ctxRef.current?.close() } catch { /* ignore */ }
      ctxRef.current = null
    }
  }, [getContext, onBlockedChange])

  return useCallback(() => {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      onBlockedChange(true)
      ctx.resume().then(() => onBlockedChange(false)).catch(() => {})
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
  }, [getContext, onBlockedChange])
}

/**
 * MG Production Dashboard header: red blinking light + repeating beep while a "Call F.M" from an
 * MG Floor tablet is unanswered. Only Floor / Production Managers see it (the API refuses others).
 */
export default function FmCallAlarm({ tenantKey = 'mg', onCallsChange }) {
  const [calls, setCalls] = useState([])
  const [allowed, setAllowed] = useState(true)
  const [muted, setMuted] = useState(readMuted)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [soundBlocked, setSoundBlocked] = useState(false)
  const requestRef = useRef(0)
  const playAlarm = useAlarmSound(setSoundBlocked)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await mgFloorFmCallsApi.list()
      if (request !== requestRef.current) return
      setCalls(Array.isArray(res?.calls) ? res.calls : [])
    } catch (err) {
      if (request !== requestRef.current) return
      const status = err?.response?.status
      if (status === 401 || status === 403) setAllowed(false)
      /* otherwise keep the last known calls; the next poll retries */
    }
  }, [])

  useEffect(() => {
    if (!allowed) return undefined
    load()
    const timer = setInterval(load, POLL_MS)
    const unsubscribe = subscribeRealtimeEvents(tenantKey, 'mg-floor:fm-call', () => load())
    return () => {
      clearInterval(timer)
      unsubscribe()
      requestRef.current += 1
    }
  }, [allowed, load, tenantKey])

  useEffect(() => {
    onCallsChange?.(allowed ? calls : [])
  }, [calls, allowed, onCallsChange])

  const ringing = calls.length > 0
  useEffect(() => {
    if (!ringing) setOpen(false)
  }, [ringing])

  useEffect(() => {
    if (!ringing || muted) return undefined
    playAlarm()
    const timer = setInterval(playAlarm, BEEP_EVERY_MS)
    return () => clearInterval(timer)
  }, [ringing, muted, playAlarm])

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev
      try { window.localStorage.setItem(FM_ALARM_MUTE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const acknowledge = async (call) => {
    if (busyId) return
    setBusyId(call._id)
    setError('')
    try {
      await mgFloorFmCallsApi.acknowledge(call._id)
      setCalls((prev) => prev.filter((c) => c._id !== call._id))
      load()
    } catch (err) {
      setError(errorMessage(err, 'Acknowledge failed'))
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (!allowed) return null
  const now = Date.now()

  return (
    <div className="pd-fm-alarm">
      <button
        type="button"
        className="pd-fm-alarm-mute"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute Call F.M alarm' : 'Mute Call F.M alarm'}
        title={muted ? 'Call F.M alarm sound is off — click to unmute' : 'Call F.M alarm sound is on — click to mute'}
      >
        <span aria-hidden>{muted ? '🔕' : '🔔'}</span>
        {muted ? 'Unmute' : 'Mute'}
      </button>

      {ringing ? (
        <button
          type="button"
          className="pd-fm-alarm-light"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-live="assertive"
          title="Operators are calling the Floor Manager — click to see and acknowledge"
        >
          <span className="pd-fm-alarm-dot" aria-hidden />
          CALL F.M
          <span className="pd-fm-alarm-count">{calls.length}</span>
        </button>
      ) : null}

      {ringing && soundBlocked && !muted ? (
        <span className="pd-fm-alarm-hint">Click anywhere to turn on sound</span>
      ) : null}

      {ringing && open ? (
        <div className="pd-fm-alarm-panel" role="dialog" aria-label="Call F.M requests">
          <div className="pd-fm-alarm-panel-head">Call F.M — {calls.length} waiting</div>
          {error ? <p className="pd-fm-alarm-error" role="alert">{error}</p> : null}
          <ul className="pd-fm-alarm-list">
            {calls.map((call) => (
              <li key={call._id} className="pd-fm-alarm-item">
                <div className="pd-fm-alarm-item-text">
                  <strong>{departmentLabel(call.metadata?.department)}</strong>
                  <span>{call.raisedByName || 'Operator'} · {formatWhen(call.createdAt, now)}</span>
                  {call.message ? <small>{call.message}</small> : null}
                </div>
                <button
                  type="button"
                  className="pd-fm-alarm-ack"
                  disabled={busyId === call._id}
                  onClick={() => acknowledge(call)}
                >
                  {busyId === call._id ? 'Saving…' : 'Acknowledge'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
