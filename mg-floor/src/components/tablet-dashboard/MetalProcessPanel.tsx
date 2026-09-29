import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'
import type { BatchEntryLine } from '@/src/api/batchEntries'

export type MetalLineEdit = {
  metal: string
  qty: string
  purity: string
  time: string
}

export type MetalBatchEdit = {
  batchLabel: string
  /** Day the batch belongs to; today when missing. */
  entryDate?: string
  lines: MetalLineEdit[]
}

export type BatchStatusTone = 'neutral' | 'warn' | 'ok' | 'bad'

export type MetalPanelRow = {
  batchLabel: string
  entryDate: string
  /** Shown under the batch number for a batch carried over from an earlier day. */
  dayTag: string
  lines: BatchEntryLine[]
  status: { label: string; tone: BatchStatusTone; note: string } | null
  /** Rejected by the Floor Manager: can be corrected and sent again. */
  canFix: boolean
}

type Props = {
  title: string
  rows: MetalPanelRow[]
  /** Tapping the orange header opens the entry popup. */
  onAdd: () => void
  onFix: (row: MetalPanelRow) => void
  compact?: boolean
}

const TONES: Record<BatchStatusTone, { bg: string; fg: string }> = {
  neutral: { bg: '#E5E7EB', fg: '#374151' },
  warn: { bg: '#FEF3C7', fg: '#92400E' },
  ok: { bg: '#DCFCE7', fg: '#166534' },
  bad: { bg: '#FEE2E2', fg: '#991B1B' },
}

const show = (n: number | null | undefined) => (n == null ? '--' : String(n))
export function MetalProcessPanel({ title, rows, onAdd, onFix, compact }: Props) {
  const pad = compact ? 6 : 8
  const fontSize = compact ? 12 : 14

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${title}`}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.header,
          compact && styles.headerCompact,
          pressed && styles.headerPressed,
        ]}
      >
        <View style={styles.addBadge}>
          <View style={styles.plusBarH} />
          <View style={styles.plusBarV} />
        </View>
        <Text style={[styles.headerText, compact && { fontSize: 17 }]}>{title}</Text>
      </Pressable>
      <View style={styles.body}>
        <View style={styles.subHeader}>
          <Text style={styles.subHeaderText}>Total Process</Text>
        </View>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.colBatch, styles.headerCell, { fontSize }]}>Batch</Text>
          <Text style={[styles.cell, styles.colMetal, styles.headerCell, { fontSize }]}>Metal</Text>
          <Text style={[styles.cell, styles.colQty, styles.headerCell, { fontSize }]}>Qty</Text>
          <Text style={[styles.cell, styles.colPurity, styles.headerCell, { fontSize }]}>Purity</Text>
          <Text style={[styles.cell, styles.colTime, styles.headerCell, { fontSize }]}>Time</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No batches yet. Tap {title} above to add one.</Text>
        ) : null}
        {rows.map((row) => {
          const tone = row.status ? TONES[row.status.tone] : null
          return (
            <View key={`${row.entryDate}|${row.batchLabel}`} style={styles.batchBlock}>
              <View style={styles.batchGroup}>
                <View style={styles.batchLabelCol}>
                  <Text style={[styles.batchText, compact && { fontSize: 14 }]}>{row.batchLabel}</Text>
                  {row.dayTag ? (
                    <Text style={styles.dayTag} numberOfLines={1} adjustsFontSizeToFit>
                      {row.dayTag}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.batchLines}>
                  {row.lines.map((line, lineIdx) => (
                    <View
                      key={`${row.batchLabel}-${line.metal}-${lineIdx}`}
                      style={[styles.lineRow, lineIdx === row.lines.length - 1 && styles.lineRowLast]}
                    >
                      <Text style={[styles.cell, styles.colMetal, styles.metalCell, { fontSize, paddingVertical: pad }]}>
                        {line.metal}
                      </Text>
                      <Text style={[styles.cell, styles.value, styles.colQty, { fontSize, paddingVertical: pad }]}>
                        {show(line.qty)}
                      </Text>
                      <Text style={[styles.cell, styles.value, styles.colPurity, { fontSize, paddingVertical: pad }]}>
                        {show(line.purity)}
                      </Text>
                      <Text style={[styles.cell, styles.value, styles.colTime, { fontSize, paddingVertical: pad }]}>
                        {line.time || '--'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {row.status || row.canFix ? (
                <View style={styles.statusRow}>
                  <View style={styles.statusInfo}>
                    {row.status && tone ? (
                      <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.pillText, { color: tone.fg }]}>{row.status.label}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.statusNote} numberOfLines={2}>
                      {row.status?.note || ''}
                    </Text>
                  </View>
                  {row.canFix ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Fix and resend batch ${row.batchLabel}`}
                      onPress={() => onFix(row)}
                      style={({ pressed }) => [
                        styles.fixBtn,
                        compact && { minHeight: 34, paddingHorizontal: 10 },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.fixText, compact && { fontSize: 12 }]}>FIX & RESEND</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  header: {
    backgroundColor: td.orange,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    borderRadius: td.buttonRadius,
    marginBottom: 10,
    ...buttonShadow,
  },
  headerCompact: { minHeight: 48 },
  headerPressed: {
    backgroundColor: td.orangePressed,
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.08,
    elevation: 1,
  },
  headerText: {
    color: td.white,
    fontFamily: td.buttonFont,
    fontWeight: '600',
    fontSize: 20,
    letterSpacing: 0.6,
  },
  addBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBarH: { position: 'absolute', width: 14, height: 2.5, borderRadius: 2, backgroundColor: td.white },
  plusBarV: { position: 'absolute', width: 2.5, height: 14, borderRadius: 2, backgroundColor: td.white },
  body: {
    flex: 1,
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.white,
    minHeight: 0,
    overflow: 'hidden',
  },
  subHeader: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  subHeaderText: { color: td.text, fontWeight: '700', fontSize: 15 },
  row: {
    flexDirection: 'row',
    minHeight: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: td.borderGrid,
  },
  headerRow: {
    backgroundColor: td.cream,
    borderBottomColor: td.borderLight,
  },
  empty: { color: td.textMuted, fontSize: 13, textAlign: 'center', padding: 18 },
  batchBlock: {
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
  },
  batchGroup: {
    flexDirection: 'row',
    minHeight: 40,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: td.borderGrid,
    backgroundColor: td.cream,
  },
  statusInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  statusNote: { flex: 1, color: td.textMuted, fontSize: 12, minWidth: 0 },
  fixBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    backgroundColor: td.orange,
    borderRadius: td.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixText: { color: td.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  batchLabelCol: {
    width: 56,
    borderRightWidth: 1,
    borderRightColor: td.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.cream,
  },
  batchText: { color: td.text, fontWeight: '800', fontSize: 16 },
  dayTag: { color: td.orange, fontWeight: '700', fontSize: 10, marginTop: 2, paddingHorizontal: 2 },
  batchLines: { flex: 1 },
  lineRow: {
    flexDirection: 'row',
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
    alignItems: 'center',
  },
  lineRowLast: { borderBottomWidth: 0 },
  cell: {
    color: td.text,
    fontWeight: '500',
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  metalCell: { fontWeight: '600' },
  value: {
    fontWeight: '600',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: td.borderGrid,
  },
  headerCell: {
    fontWeight: '700',
    color: td.textMuted,
  },
  colBatch: { width: 56 },
  colMetal: { flex: 1.1, textAlign: 'left' },
  colQty: { flex: 1 },
  colPurity: { flex: 1 },
  colTime: { flex: 1 },
})
