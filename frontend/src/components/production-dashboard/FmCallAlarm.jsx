import { mgFloorFmCallsApi } from '../../api/mgFloorFmCalls'
import FloorAlarm from './FloorAlarm'

export const FM_ALARM_MUTE_KEY = 'pd.fmAlarmMuted'

/** Three short beeps (high, low, high). */
function playBeeps(ctx) {
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
}

/** Rings while a "Call F.M" from an MG Floor tablet is unanswered; `silenced` pauses the beeps during a breakdown. */
export default function FmCallAlarm({ tenantKey = 'mg', onCallsChange, silenced = false }) {
  return (
    <FloorAlarm
      tenantKey={tenantKey}
      api={mgFloorFmCallsApi}
      listKey="calls"
      eventType="mg-floor:fm-call"
      muteKey={FM_ALARM_MUTE_KEY}
      name="Call F.M"
      label="CALL F.M"
      lightTitle="Operators are calling the Floor Manager — click to see and acknowledge"
      playSound={playBeeps}
      repeatMs={4000}
      silenced={silenced}
      onAlarmsChange={onCallsChange}
    />
  )
}
