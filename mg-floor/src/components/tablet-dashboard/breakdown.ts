import type { BreakdownStatus } from '@/src/api/floor'

export type BreakdownPhase = 'idle' | 'sending' | 'waiting' | 'acknowledged' | 'fixing' | 'fixed' | 'error'

export const FIX_NOTE_MAX = 300

export const breakdownPhaseFor = (alert: BreakdownStatus): BreakdownPhase =>
  alert.status === 'OPEN' ? 'waiting' : alert.status === 'ACKNOWLEDGED' ? 'acknowledged' : 'fixed'

/** The machine is still down: pressing BREAKDOWN opens it again instead of reporting a new one. */
export const isMachineDown = (phase: BreakdownPhase) =>
  phase === 'sending' || phase === 'waiting' || phase === 'acknowledged' || phase === 'fixing'

/** Small text under the BREAKDOWN button. */
export function breakdownButtonStatus(phase: BreakdownPhase): string | undefined {
  if (phase === 'waiting') return 'Waiting for F.M…'
  if (phase === 'acknowledged' || phase === 'fixing') return 'Machine down · tap when fixed'
  return undefined
}

/** 135 -> "2 h 15 min", 40 -> "40 min", 0 -> "less than a minute". */
export function formatDowntime(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  if (minutes < 1) return 'less than a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const cleanFixNote = (note: string) => note.trim().slice(0, FIX_NOTE_MAX)
