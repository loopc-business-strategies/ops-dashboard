import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import type { BatchStats, LossAvg, LossRef } from '@/src/api/batchStats'
import { StatsCard, type StatRow } from './StatsCard'
import {
  batchRefLabel,
  compareToOverall,
  elapsedMinutes,
  formatGrams,
  formatMinutes,
  formatPct,
  isOverLimit,
  type StatTone,
} from './statsFormat'

const TICK_MS = 30000

const joinNote = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' · ')
const batchesNote = (n: number) => `${n} batch${n === 1 ? '' : 'es'}`

type LossProps = {
  stats: BatchStats | null
  today: string
  canSetLimit: boolean
  onEditLimit: () => void
}

/** Metal loss (Metal In − Metal Out) of approved batches; red above the manager's limit. */
export function MetalLossCard({ stats, today, canSetLimit, onEditLimit }: LossProps) {
  const limit = stats?.lossLimitPct ?? null
  const loss = stats?.loss
  const toneFor = (pct: number | null | undefined): StatTone => (isOverLimit(pct, limit) ? 'bad' : 'neutral')

  const refRow = (label: string, ref: LossRef | null | undefined, best = false): StatRow => ({
    label,
    value: ref ? formatGrams(ref.loss) : '--',
    note: ref ? joinNote(formatPct(ref.lossPct), batchRefLabel(ref, today)) : '',
    tone: best && ref ? 'good' : toneFor(ref?.lossPct),
  })
  const avgRow = (label: string, avg: LossAvg | null | undefined, showCount: boolean): StatRow => ({
    label,
    value: avg ? formatGrams(avg.loss) : '--',
    note: avg ? joinNote(formatPct(avg.lossPct), showCount && batchesNote(avg.batches)) : '',
    tone: toneFor(avg?.lossPct),
  })

  const rows: StatRow[] = [
    refRow('Last batch', loss?.last),
    avgRow('Today total', loss?.todayTotal, true),
    avgRow('Today avg', loss?.todayAvg, false),
    avgRow('Overall avg', loss?.overallAvg, true),
    refRow('Best today', loss?.bestToday, true),
    refRow('Best ever', loss?.bestEver, true),
  ]

  const limitText = limit != null ? `Limit ${formatPct(limit)}` : canSetLimit ? 'Set limit' : 'No limit'
  const headerRight = canSetLimit ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change metal loss limit"
      onPress={onEditLimit}
      hitSlop={6}
      style={({ pressed }) => [styles.limitBtn, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.limitBtnText}>{limitText} ✎</Text>
    </Pressable>
  ) : (
    <Text style={styles.limitText}>{limitText}</Text>
  )

  return (
    <StatsCard
      title="Metal Loss"
      headerRight={headerRight}
      rows={rows}
      empty={stats ? undefined : 'Loss shows once batches are approved.'}
    />
  )
}

type TimeProps = {
  stats: BatchStats | null
  today: string
}

/** Metal In → Metal Out time of approved batches, with a live timer for the running batch. */
export function BatchTimeCard({ stats, today }: TimeProps) {
  const time = stats?.time
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!time?.running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [time?.running])

  const running = time?.running
  const startedClock = running ? new Date(running.startedAt).toTimeString().slice(0, 5) : ''
  const compare = compareToOverall(time?.todayAvg?.minutes, time?.overallAvg?.minutes)

  const rows: StatRow[] = [
    {
      label: 'Running',
      value: running ? formatMinutes(elapsedMinutes(running.startedAt, now)) : '--',
      note: running ? joinNote(batchRefLabel(running, today), `since ${startedClock}`) : 'No batch running',
    },
    {
      label: 'Last batch',
      value: formatMinutes(time?.last?.minutes),
      note: time?.last ? batchRefLabel(time.last, today) : '',
    },
    {
      label: 'Today avg',
      value: formatMinutes(time?.todayAvg?.minutes),
      note: compare?.text || (time?.todayAvg ? batchesNote(time.todayAvg.batches) : ''),
      noteTone: compare?.tone,
    },
    {
      label: 'Overall avg',
      value: formatMinutes(time?.overallAvg?.minutes),
      note: time?.overallAvg ? batchesNote(time.overallAvg.batches) : '',
    },
    {
      label: 'Best today',
      value: formatMinutes(time?.bestToday?.minutes),
      note: time?.bestToday ? batchRefLabel(time.bestToday, today) : '',
      tone: time?.bestToday ? 'good' : 'neutral',
    },
    {
      label: 'Best ever',
      value: formatMinutes(time?.bestEver?.minutes),
      note: time?.bestEver ? batchRefLabel(time.bestEver, today) : '',
      tone: time?.bestEver ? 'good' : 'neutral',
    },
  ]

  return <StatsCard title="Batch Time" rows={rows} empty={stats ? undefined : 'Times show once batches are approved.'} />
}

const styles = StyleSheet.create({
  limitBtn: {
    borderWidth: 1,
    borderColor: td.orange,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: td.white,
  },
  limitBtnText: { color: td.orange, fontWeight: '800', fontSize: 11 },
  limitText: { color: td.textMuted, fontWeight: '700', fontSize: 11 },
})
