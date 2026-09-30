import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'

const POLL_MS = 15000

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

function readMuted(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** Browsers keep an AudioContext suspended until the page has had a click or key press. */
function useAlarmSound(playSound, onBlockedChange) {
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
    playSound(ctx)
  }, [getContext, onBlockedChange, playSound])
}

/**
 * MG Production Dashboard header alarm: red blinking light + repeating sound while alarms raised
 * from MG Floor tablets are unanswered. Only Floor / Production Managers see it (the API refuses others).
 */
export default function FloorAlarm({
  tenantKey = 'mg',
  api,
  listKey,
  eventType,
  muteKey,
  name,
  label,
  lightTitle,
  playSound,
  repeatMs,
  variant = '',
  alwaysShowMute = true,
  /** Keeps the light blinking but stops the sound (a more urgent alarm is ringing). */
  silenced = false,
  onAlarmsChange,
}) {
  const [alarms, setAlarms] = useState([])
  const [allowed, setAllowed] = useState(true)
  const [muted, setMuted] = useState(() => readMuted(muteKey))
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [soundBlocked, setSoundBlocked] = useState(false)
  const requestRef = useRef(0)
  const playAlarm = useAlarmSound(playSound, setSoundBlocked)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await api.list()
      if (request !== requestRef.current) return
      setAlarms(Array.isArray(res?.[listKey]) ? res[listKey] : [])
    } catch (err) {
      if (request !== requestRef.current) return
      const status = err?.response?.status
      if (status === 401 || status === 403) setAllowed(false)
      /* otherwise keep the last known alarms; the next poll retries */
    }
  }, [api, listKey])

  useEffect(() => {
    if (!allowed) return undefined
    load()
    const timer = setInterval(load, POLL_MS)
    const unsubscribe = subscribeRealtimeEvents(tenantKey, eventType, () => load())
    return () => {
      clearInterval(timer)
      unsubscribe()
      requestRef.current += 1
    }
  }, [allowed, load, tenantKey, eventType])

  useEffect(() => {
    onAlarmsChange?.(allowed ? alarms : [])
  }, [alarms, allowed, onAlarmsChange])

  const ringing = alarms.length > 0
  useEffect(() => {
    if (!ringing) setOpen(false)
  }, [ringing])

  useEffect(() => {
    if (!ringing || muted || silenced) return undefined
    playAlarm()
    const timer = setInterval(playAlarm, repeatMs)
    return () => clearInterval(timer)
  }, [ringing, muted, silenced, playAlarm, repeatMs])

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev
      try { window.localStorage.setItem(muteKey, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const acknowledge = async (alarm) => {
    if (busyId) return
    setBusyId(alarm._id)
    setError('')
    try {
      await api.acknowledge(alarm._id)
      setAlarms((prev) => prev.filter((a) => a._id !== alarm._id))
      load()
    } catch (err) {
      setError(errorMessage(err, 'Acknowledge failed'))
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (!allowed) return null
  if (!ringing && !alwaysShowMute) return null
  const now = Date.now()
  const variantClass = variant ? ` pd-fm-alarm--${variant}` : ''

  return (
    <div className={`pd-fm-alarm${variantClass}`}>
      <button
        type="button"
        className="pd-fm-alarm-mute"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? `Unmute ${name} alarm` : `Mute ${name} alarm`}
        title={muted ? `${name} alarm sound is off — click to unmute` : `${name} alarm sound is on — click to mute`}
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
          title={lightTitle}
        >
          <span className="pd-fm-alarm-dot" aria-hidden />
          {label}
          <span className="pd-fm-alarm-count">{alarms.length}</span>
        </button>
      ) : null}

      {ringing && soundBlocked && !muted ? (
        <span className="pd-fm-alarm-hint">Click anywhere to turn on sound</span>
      ) : null}

      {ringing && open ? (
        <div className="pd-fm-alarm-panel" role="dialog" aria-label={`${name} requests`}>
          <div className="pd-fm-alarm-panel-head">{name} — {alarms.length} waiting</div>
          {error ? <p className="pd-fm-alarm-error" role="alert">{error}</p> : null}
          <ul className="pd-fm-alarm-list">
            {alarms.map((alarm) => (
              <li key={alarm._id} className="pd-fm-alarm-item">
                <div className="pd-fm-alarm-item-text">
                  <strong>{departmentLabel(alarm.metadata?.department)}</strong>
                  <span>{alarm.raisedByName || 'Operator'} · {formatWhen(alarm.createdAt, now)}</span>
                  {alarm.message ? <small>{alarm.message}</small> : null}
                </div>
                <button
                  type="button"
                  className="pd-fm-alarm-ack"
                  disabled={busyId === alarm._id}
                  onClick={() => acknowledge(alarm)}
                >
                  {busyId === alarm._id ? 'Saving…' : 'Acknowledge'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
