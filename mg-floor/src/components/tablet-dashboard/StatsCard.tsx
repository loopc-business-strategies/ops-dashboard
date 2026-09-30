import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import type { StatTone } from './statsFormat'

export type StatRow = {
  label: string
  value: string
  /** Small text after the value, e.g. "0.77% · Batch 2". */
  note?: string
  tone?: StatTone
  noteTone?: StatTone
}

type Props = {
  title: string
  rows: StatRow[]
  /** Right side of the title bar (e.g. the loss limit). */
  headerRight?: React.ReactNode
  /** Shown instead of the rows before anything can be counted. */
  empty?: string
}

const TONE_COLORS: Record<StatTone, string> = {
  neutral: td.text,
  good: '#15803D',
  bad: '#B91C1C',
}

export function StatsCard({ title, rows, headerRight, empty }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {headerRight}
      </View>
      {empty ? <Text style={styles.empty}>{empty}</Text> : null}
      {!empty
        ? rows.map((row, idx) => (
          <View key={row.label} style={[styles.row, idx === rows.length - 1 && styles.rowLast]}>
            <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
            <Text style={[styles.value, { color: TONE_COLORS[row.tone || 'neutral'] }]} numberOfLines={1}>
              {row.value}
            </Text>
            <Text
              style={[styles.note, row.noteTone && row.noteTone !== 'neutral' && { color: TONE_COLORS[row.noteTone] }]}
              numberOfLines={1}
            >
              {row.note || ''}
            </Text>
          </View>
        ))
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.white,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingHorizontal: 10,
    minHeight: 30,
  },
  title: { color: td.text, fontWeight: '700', fontSize: 14 },
  empty: { color: td.textMuted, fontSize: 12, textAlign: 'center', padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { flex: 1.1, color: td.textMuted, fontSize: 12, fontWeight: '600' },
  value: { flex: 0.9, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  note: { flex: 1.5, color: td.textMuted, fontSize: 11, textAlign: 'right' },
})
