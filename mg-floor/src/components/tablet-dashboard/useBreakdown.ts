import { useCallback, useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { getBreakdown, reportBreakdown, type BreakdownStatus } from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { createOperationId } from '@/src/offline/outbox'

export type BreakdownPhase = 'idle' | 'sending' | 'waiting' | 'acknowledged' | 'error'

const POLL_MS = 5000

type State = { phase: BreakdownPhase; alert: BreakdownStatus | null; error: string }
const IDLE: State = { phase: 'idle', alert: null, error: '' }

export const breakdownPhaseFor = (alert: BreakdownStatus): BreakdownPhase =>
  alert.status === 'OPEN' ? 'waiting' : 'acknowledged'

/** Reports a Breakdown for this tablet's department and follows it until the Floor Manager acknowledges. */
export function useBreakdown({ token, department }: { token: string | null; department: string }) {
  const [state, setState] = useState<State>(IDLE)
  const sendingRef = useRef(false)

  const report = useCallback(async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    setState({ phase: 'sending', alert: null, error: '' })
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) throw new Error('Network unavailable — try again when online.')
      const res = await reportBreakdown({ department: department || '', operationId: createOperationId('breakdown') })
      setState({ phase: breakdownPhaseFor(res.alert), alert: res.alert, error: '' })
    } catch (err) {
      setState({ phase: 'error', alert: null, error: userFacingMessage(err) || 'Could not report the breakdown.' })
    } finally {
      sendingRef.current = false
    }
  }, [department])

  const waitingId = state.phase === 'waiting' ? state.alert?._id : undefined
  useEffect(() => {
    if (!waitingId || !token) return undefined
    const timer = setInterval(() => {
      getBreakdown(waitingId)
        .then((res) => {
          if (res.alert.status === 'OPEN') return
          setState((s) => (s.alert?._id === waitingId ? { phase: 'acknowledged', alert: res.alert, error: '' } : s))
        })
        .catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [waitingId, token])

  /** Clears a finished report; a breakdown still waiting for the F.M keeps showing. */
  const dismiss = useCallback(() => {
    setState((s) => (s.phase === 'waiting' || s.phase === 'sending' ? s : IDLE))
  }, [])

  return { ...state, report, dismiss }
}
