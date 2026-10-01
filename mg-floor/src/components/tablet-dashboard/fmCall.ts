import type { AlarmStatus } from '@/src/api/floor'

export type FmCallPhase = 'idle' | 'sending' | 'waiting' | 'coming' | 'error'

/** OPEN = the F.M has not answered yet; acknowledged (or resolved) = "F.M is coming". */
export const fmCallPhaseFor = (alert: Pick<AlarmStatus, 'status'>): FmCallPhase =>
  alert.status === 'OPEN' ? 'waiting' : 'coming'

/** Shown under "Call F.M" on the button while a call is in progress. */
export function fmCallButtonStatus(phase: FmCallPhase): string | undefined {
  if (phase === 'sending') return 'Calling…'
  if (phase === 'waiting') return 'Waiting for F.M…'
  if (phase === 'coming') return 'F.M is coming'
  return undefined
}
