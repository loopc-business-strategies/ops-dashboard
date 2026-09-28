import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import {
  PURITY_MAX_LENGTH,
  QTY_MAX_LENGTH,
  TIME_MAX_LENGTH,
  cleanNumberInput,
  formatTimeTyping,
  isImpossibleTime,
  normalizeTime,
} from './fieldInput'

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

export type BatchStatusTone = 'neutral' | 'warn' | 'ok' | 'bad'

export type BatchApprovalRow = {
  locked: boolean
  busy: boolean
  status: { label: string; tone: BatchStatusTone; note: string } | null
}

/** Per-batch CONFIRM for Floor Manager approval. */
export type PanelApproval = {
  rows: Record<string, BatchApprovalRow | undefined>
  canConfirm: boolean
  /** Shown beside the CONFIRM button while it cannot be used (e.g. not logged in). */
  hint?: string
  message?: string | null
  onConfirm: (batch: MetalBatchEdit) => void
}

type Props = {
  title: string
  batches: MetalBatchEdit[]
  onChange: React.Dispatch<React.SetStateAction<MetalBatchEdit[]>>
  action?: MetalPanelAction
  approval?: PanelApproval
  compact?: boolean
}

const TONES: Record<BatchStatusTone, { bg: string; fg: string }> = {
  neutral: { bg: '#E5E7EB', fg: '#374151' },
  warn: { bg: '#FEF3C7', fg: '#92400E' },
  ok: { bg: '#DCFCE7', fg: '#166534' },
  bad: { bg: '#FEE2E2', fg: '#991B1B' },
}

export function MetalProcessPanel({
  title,
  batches,
  onChange,
  action,
  approval,
  compact,
}: Props) {
  const pad = compact ? 6 : 8
  const fontSize = compact ? 12 : 14

  const setField = (batchIdx: number, lineIdx: number, key: keyof MetalLineEdit, value: string) => {
    onChange((current) =>
      current.map((b, bi) => {
        if (bi !== batchIdx) return b
        return {
          ...b,
          lines: b.lines.map((line, li) => (li === lineIdx ? { ...line, [key]: value } : line)),
        }
      }),
    )
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
        {batches.map((batch, batchIdx) => {
          const row = approval?.rows[batch.batchLabel]
          const locked = Boolean(row?.locked)
          const inputStyle = [styles.input, locked && styles.inputLocked, { fontSize, paddingVertical: pad }]
          const tone = row?.status ? TONES[row.status.tone] : null
          const confirmDisabled = !approval?.canConfirm || Boolean(row?.busy)
          return (
            <View key={batch.batchLabel} style={styles.batchBlock}>
              <View style={styles.batchGroup}>
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
                        accessibilityLabel={`${title} batch ${batch.batchLabel} ${line.metal} Qty`}
                        style={[...inputStyle, styles.colQty]}
                        value={line.qty}
                        onChangeText={(v) => setField(batchIdx, lineIdx, 'qty', cleanNumberInput(v, QTY_MAX_LENGTH))}
                        editable={!locked}
                        placeholder="--"
                        placeholderTextColor={td.textMuted}
                        keyboardType="decimal-pad"
                        maxLength={QTY_MAX_LENGTH}
                      />
                      <TextInput
                        accessibilityLabel={`${title} batch ${batch.batchLabel} ${line.metal} Purity`}
                        style={[...inputStyle, styles.colPurity]}
                        value={line.purity}
                        onChangeText={(v) =>
                          setField(batchIdx, lineIdx, 'purity', cleanNumberInput(v, PURITY_MAX_LENGTH))
                        }
                        editable={!locked}
                        placeholder="--"
                        placeholderTextColor={td.textMuted}
                        keyboardType="decimal-pad"
                        maxLength={PURITY_MAX_LENGTH}
                      />
                      <TextInput
                        accessibilityLabel={`${title} batch ${batch.batchLabel} ${line.metal} Time`}
                        style={[
                          ...inputStyle,
                          styles.colTime,
                          isImpossibleTime(line.time) && styles.inputInvalid,
                        ]}
                        value={line.time}
                        onChangeText={(v) => setField(batchIdx, lineIdx, 'time', formatTimeTyping(v))}
                        onBlur={() => {
                          const time = normalizeTime(line.time)
                          if (time && time !== line.time) setField(batchIdx, lineIdx, 'time', time)
                        }}
                        editable={!locked}
                        placeholder="HH:MM"
                        placeholderTextColor={td.textMuted}
                        keyboardType="decimal-pad"
                        maxLength={TIME_MAX_LENGTH}
                      />
                    </View>
                  ))}
                </View>
              </View>
              {approval ? (
                <View style={styles.approvalRow}>
                  <View style={styles.approvalInfo}>
                    {row?.status && tone ? (
                      <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.pillText, { color: tone.fg }]}>{row.status.label}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.approvalNote} numberOfLines={2}>
                      {row?.status?.note || (!approval.canConfirm && !locked ? approval.hint || '' : '')}
                    </Text>
                  </View>
                  {!locked ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Confirm batch ${batch.batchLabel}`}
                      accessibilityState={{ disabled: confirmDisabled, busy: Boolean(row?.busy) }}
                      disabled={confirmDisabled}
                      onPress={() => approval.onConfirm(batch)}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        compact && { minHeight: 34, paddingHorizontal: 10 },
                        { opacity: confirmDisabled ? 0.45 : pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={[styles.confirmText, compact && { fontSize: 12 }]}>
                        {row?.busy ? 'SENDING…' : `CONFIRM BATCH ${batch.batchLabel}`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}
        {approval?.message ? <Text style={styles.approvalError}>{approval.message}</Text> : null}
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
  batchBlock: {
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
  },
  batchGroup: {
    flexDirection: 'row',
    minHeight: 80,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: td.borderGrid,
    backgroundColor: td.cream,
  },
  approvalInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  approvalNote: { flex: 1, color: td.textMuted, fontSize: 12, minWidth: 0 },
  confirmBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    backgroundColor: td.orange,
    borderRadius: td.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: td.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  approvalError: { color: '#B91C1C', fontSize: 13, fontWeight: '600', margin: 8 },
  inputLocked: { color: td.textMuted, backgroundColor: '#F9FAFB' },
  inputInvalid: { backgroundColor: '#FEE2E2', color: '#991B1B' },
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
    paddingHorizontal: 4,
    textAlign: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: td.borderGrid,
    minHeight: 36,
    minWidth: 0,
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
