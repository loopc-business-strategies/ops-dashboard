import { useCallback, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { callFloorManager, getFmCall, type AlarmStatus } from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { fmCallPhaseFor, type FmCallPhase } from './fmCall'

const POLL_MS = 5000

type State = { phase: FmCallPhase; alert: AlarmStatus | null; error: string }
const IDLE: State = { phase: 'idle', alert: null, error: '' }

/** Raises a Call F.M and follows it until a Floor Manager acknowledges it on the Production Dashboard. */
export function useFmCall({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(IDLE)
  const sendingRef = useRef(false)

  const call = useCallback(async (body: Record<string, unknown>) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setState({ phase: 'sending', alert: null, error: '' })
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) throw new Error('Network unavailable — try again when online.')
      const res = await callFloorManager(body)
      const raised = res.alert
      if (!raised?._id) throw new Error('Unable to raise alert')
      const alert: AlarmStatus = {
        _id: raised._id,
        status: raised.status,
        department: raised.metadata?.department || String(body.department || ''),
        createdAt: raised.createdAt,
        acknowledgedByName: raised.acknowledgedByName || '',
        acknowledgedAt: raised.acknowledgedAt || null,
      }
      setState({ phase: fmCallPhaseFor(alert), alert, error: '' })
    } catch (err) {
      setState({ phase: 'error', alert: null, error: userFacingMessage(err) || 'Unable to raise alert' })
    } finally {
      sendingRef.current = false
    }
  }, [])

  const waitingId = state.phase === 'waiting' ? state.alert?._id : undefined
  useEffect(() => {
    if (!waitingId || !token) return undefined
    const timer = setInterval(() => {
      getFmCall(waitingId)
        .then((res) => {
          if (res.alert.status === 'OPEN') return
          setState((s) => (s.alert?._id === waitingId ? { phase: 'coming', alert: res.alert, error: '' } : s))
        })
        .catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [waitingId, token])

  /** Clears a finished call; one still waiting for the F.M keeps showing. */
  const dismiss = useCallback(() => {
    setState((s) => (s.phase === 'waiting' || s.phase === 'sending' ? s : IDLE))
  }, [])

  return { ...state, call, dismiss }
}
