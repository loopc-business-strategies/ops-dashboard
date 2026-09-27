import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

export type MetalLineEdit = {
  metal: string
  qty: string
  purity: string
  time: string
}

export type MetalBatchEdit = {
  batchLabel: string
  lines: MetalLineEdit[]
}

export type MetalPanelAction = {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Shown under the button while it is disabled. */
  disabledHint?: string
}

type Props = {
  title: string
  batches: MetalBatchEdit[]
  onChange: (batches: MetalBatchEdit[]) => void
  action?: MetalPanelAction
  compact?: boolean
}

export function MetalProcessPanel({
  title,
  batches,
  onChange,
  action,
  compact,
}: Props) {
  const pad = compact ? 6 : 8
  const fontSize = compact ? 12 : 14

  const setField = (batchIdx: number, lineIdx: number, key: keyof MetalLineEdit, value: string) => {
    const next = batches.map((b, bi) => {
      if (bi !== batchIdx) return b
      return {
        ...b,
        lines: b.lines.map((line, li) => (li === lineIdx ? { ...line, [key]: value } : line)),
      }
    })
    onChange(next)
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <Text style={[styles.headerText, compact && { fontSize: 18 }]}>{title}</Text>
      </View>
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
        {batches.map((batch, batchIdx) => (
          <View key={batch.batchLabel} style={styles.batchGroup}>
            <View style={styles.batchLabelCol}>
              <Text style={[styles.batchText, compact && { fontSize: 14 }]}>{batch.batchLabel}</Text>
            </View>
            <View style={styles.batchLines}>
              {batch.lines.map((line, lineIdx) => (
                <View
                  key={`${batch.batchLabel}-${line.metal}`}
                  style={[styles.lineRow, lineIdx === batch.lines.length - 1 && styles.lineRowLast]}
                >
                  <Text style={[styles.cell, styles.colMetal, { fontSize, paddingVertical: pad }]}>
                    {line.metal}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.colQty, { fontSize, paddingVertical: pad }]}
                    value={line.qty}
                    onChangeText={(v) => setField(batchIdx, lineIdx, 'qty', v)}
                    placeholder="--"
                    placeholderTextColor={td.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.colPurity, { fontSize, paddingVertical: pad }]}
                    value={line.purity}
                    onChangeText={(v) => setField(batchIdx, lineIdx, 'purity', v)}
                    placeholder="--"
                    placeholderTextColor={td.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.colTime, { fontSize, paddingVertical: pad }]}
                    value={line.time}
                    onChangeText={(v) => setField(batchIdx, lineIdx, 'time', v)}
                    placeholder="--"
                    placeholderTextColor={td.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
        {action ? (
          <View style={styles.actionWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(action.disabled) }}
              disabled={action.disabled}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionBtn,
                compact && { minHeight: 40 },
                { opacity: action.disabled ? 0.45 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.actionText, compact && { fontSize: 14 }]}>{action.label}</Text>
            </Pressable>
            {action.disabled && action.disabledHint ? (
              <Text style={styles.actionHint}>{action.disabledHint}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0 },
  header: {
    backgroundColor: td.orange,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: td.radius,
    borderTopRightRadius: td.radius,
  },
  headerCompact: { minHeight: 44 },
  headerText: {
    color: td.white,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: td.border,
    borderBottomLeftRadius: td.radius,
    borderBottomRightRadius: td.radius,
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
  batchGroup: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    minHeight: 80,
  },
  batchLabelCol: {
    width: 56,
    borderRightWidth: 1,
    borderRightColor: td.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.cream,
  },
  batchText: { color: td.text, fontWeight: '800', fontSize: 16 },
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
  headerCell: {
    fontWeight: '700',
    color: td.textMuted,
  },
  input: {
    color: td.text,
    fontWeight: '600',
    // Web inputs have an intrinsic width; without this the three columns overflow and Time is clipped.
    minWidth: 0,
    paddingHorizontal: 4,
    textAlign: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: td.borderGrid,
    minHeight: 36,
  },
  colBatch: { width: 56 },
  colMetal: { flex: 1.1, textAlign: 'left' },
  colQty: { flex: 1 },
  colPurity: { flex: 1 },
  colTime: { flex: 1 },
  actionWrap: { margin: 10, gap: 4 },
  actionBtn: {
    minHeight: 48,
    backgroundColor: td.orange,
    borderRadius: td.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: td.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  actionHint: { color: td.textMuted, fontSize: 12, textAlign: 'center' },
})
