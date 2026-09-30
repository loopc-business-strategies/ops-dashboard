import { mgFloorBreakdownsApi } from '../../api/mgFloorBreakdowns'
import FloorAlarm from './FloorAlarm'

export const BREAKDOWN_ALARM_MUTE_KEY = 'pd.breakdownAlarmMuted'

/** Siren: two rising-and-falling sweeps, harsher than the Call F.M beeps. */
function playSiren(ctx) {
  const start = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(650, start)
  ;[0, 0.8].forEach((offset) => {
    osc.frequency.linearRampToValueAtTime(1350, start + offset + 0.4)
    osc.frequency.linearRampToValueAtTime(650, start + offset + 0.8)
  })
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.05)
  gain.gain.setValueAtTime(0.22, start + 1.5)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + 1.62)
}

/** Rings while a Breakdown reported from an MG Floor tablet is unacknowledged. */
export default function BreakdownAlarm({ tenantKey = 'mg', onBreakdownsChange }) {
  return (
    <FloorAlarm
      tenantKey={tenantKey}
      api={mgFloorBreakdownsApi}
      listKey="breakdowns"
      eventType="mg-floor:breakdown"
      muteKey={BREAKDOWN_ALARM_MUTE_KEY}
      name="Breakdown"
      label="BREAKDOWN"
      lightTitle="A department reported a breakdown — click to see and acknowledge"
      playSound={playSiren}
      repeatMs={2500}
      variant="breakdown"
      alwaysShowMute={false}
      onAlarmsChange={onBreakdownsChange}
    />
  )
}
