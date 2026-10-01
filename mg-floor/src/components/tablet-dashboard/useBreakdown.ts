import { useCallback, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import {
  getBreakdown,
  getCurrentBreakdown,
  markBreakdownFixed,
  reportBreakdown,
  type BreakdownStatus,
} from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { createOperationId } from '@/src/offline/outbox'
import { breakdownPhaseFor, cleanFixNote, type BreakdownPhase } from './breakdown'

const POLL_WAITING_MS = 5000
const POLL_DOWN_MS = 15000

type State = { phase: BreakdownPhase; alert: BreakdownStatus | null; error: string; fixError: string }
const IDLE: State = { phase: 'idle', alert: null, error: '', fixError: '' }

/**
 * Reports a Breakdown for this tablet's department, follows it until the Floor Manager acknowledges,
 * and keeps it open (also after an app restart) until someone marks the machine fixed.
 */
export function useBreakdown({ token, department }: { token: string | null; department: string }) {
  const [state, setState] = useState<State>(IDLE)
  const sendingRef = useRef(false)

  useEffect(() => {
    setState((s) => (s.alert?.department && s.alert.department !== department && s.phase !== 'sending' && s.phase !== 'fixing' ? IDLE : s))
    if (!token || !department) return undefined
    let alive = true
    getCurrentBreakdown(department)
      .then((res) => {
        if (!alive || !res.alert) return
        const alert = res.alert
        setState((s) => (s.phase === 'idle' ? { ...IDLE, phase: breakdownPhaseFor(alert), alert } : s))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [token, department])

  const report = useCallback(async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    setState({ ...IDLE, phase: 'sending' })
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) throw new Error('Network unavailable — try again when online.')
      const res = await reportBreakdown({ department: department || '', operationId: createOperationId('breakdown') })
      setState({ ...IDLE, phase: breakdownPhaseFor(res.alert), alert: res.alert })
    } catch (err) {
      setState({ ...IDLE, phase: 'error', error: userFacingMessage(err) || 'Could not report the breakdown.' })
    } finally {
      sendingRef.current = false
    }
  }, [department])

  const fix = useCallback(async (note: string) => {
    const alert = state.alert
    if (!alert || sendingRef.current) return
    sendingRef.current = true
    const before = state.phase
    setState((s) => ({ ...s, phase: 'fixing', fixError: '' }))
    try {
      const res = await markBreakdownFixed(alert._id, cleanFixNote(note))
      setState({ ...IDLE, phase: 'fixed', alert: res.alert })
    } catch (err) {
      setState((s) => ({ ...s, phase: before, fixError: userFacingMessage(err) || 'Could not save — try again.' }))
    } finally {
      sendingRef.current = false
    }
  }, [state.alert, state.phase])

  const followId = state.phase === 'waiting' || state.phase === 'acknowledged' ? state.alert?._id : undefined
  const pollMs = state.phase === 'waiting' ? POLL_WAITING_MS : POLL_DOWN_MS
  useEffect(() => {
    if (!followId || !token) return undefined
    const timer = setInterval(() => {
      getBreakdown(followId)
        .then((res) => {
          const phase = breakdownPhaseFor(res.alert)
          setState((s) => (s.alert?._id === followId && (s.phase === 'waiting' || s.phase === 'acknowledged')
            ? { ...s, phase, alert: res.alert }
            : s))
        })
        .catch(() => {})
    }, pollMs)
    return () => clearInterval(timer)
  }, [followId, pollMs, token])

  /** Clears a fixed or failed report; a machine still down keeps showing. */
  const dismiss = useCallback(() => {
    setState((s) => (s.phase === 'fixed' || s.phase === 'error' ? IDLE : { ...s, fixError: '' }))
  }, [])

  return { ...state, report, fix, dismiss }
}
