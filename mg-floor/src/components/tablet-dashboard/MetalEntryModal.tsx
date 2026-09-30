import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { tabletDashboard as td } from '@/src/theme'
import { PURITY_MAX_LENGTH, QTY_MAX_LENGTH, cleanNumberInput } from './fieldInput'
import { MAX_BATCH_LINES, METAL_OPTIONS, clockNow, dayTag, localDateKey, type BatchChoice } from './batchEntryMapping'
import type { MetalBatchEdit, MetalLineEdit } from './MetalProcessPanel'

type Props = {
  visible: boolean
  title: string
  /** Batches to choose from; a single entry is shown without a choice. */
  batchOptions: BatchChoice[]
  /** Starting rows (default metals, or the rejected batch being fixed). */
  initial: MetalBatchEdit
  /** Metals "+ Add metal" can offer. */
  metalOptions?: string[]
  canSend: boolean
  /** Why sending is not possible (e.g. not logged in). */
  hint?: string
  /** Logged-in employees; with more than one, someone must be picked as "Sent by". */
  senders?: Array<{ id: string; name: string }>
  /** Resolves to an error message, or null once the batch is sent or saved offline. */
  onSend: (batch: MetalBatchEdit, senderId: string | null) => Promise<string | null>
  onClose: () => void
}

/** Space the send/cancel buttons (plus sheet and backdrop padding) take below the scrolling fields. */
const FOOTER_HEIGHT = 170

const choiceOf = (batch: MetalBatchEdit): BatchChoice => ({
  entryDate: batch.entryDate || localDateKey(),
  batchLabel: batch.batchLabel,
})

const sameChoice = (a: BatchChoice, b: BatchChoice) => a.entryDate === b.entryDate && a.batchLabel === b.batchLabel

function choiceTitle(choice: BatchChoice) {
  const tag = dayTag(choice.entryDate)
  return tag ? `Batch ${choice.batchLabel} · ${tag}` : `Batch ${choice.batchLabel}`
}

export function MetalEntryModal({
  visible,
  title,
  batchOptions,
  initial,
  metalOptions = METAL_OPTIONS,
  canSend,
  hint,
  senders = [],
  onSend,
  onClose,
}: Props) {
  const [choice, setChoice] = useState<BatchChoice>(() => choiceOf(initial))
  const [senderId, setSenderId] = useState<string | null>(null)
  const pickSender = senders.length > 1
  const effectiveSender = pickSender
    ? (senders.some((s) => s.id === senderId) ? senderId : null)
    : (senders[0]?.id ?? null)
  const [lines, setLines] = useState<MetalLineEdit[]>(initial.lines)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(clockNow)

  useEffect(() => {
    if (!visible) return
    setNow(clockNow())
    const timer = setInterval(() => setNow(clockNow()), 1000)
    return () => clearInterval(timer)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    setChoice(choiceOf(initial))
    setLines(initial.lines)
    setPicking(false)
    setError(null)
    setSenderId(null)
  }, [visible, initial])

  useEffect(() => {
    if (visible && batchOptions.length && !batchOptions.some((option) => sameChoice(option, choice))) {
      setChoice(batchOptions[0])
    }
  }, [visible, batchOptions, choice])

  const setField = (idx: number, key: keyof MetalLineEdit, value: string) =>
    setLines((current) => current.map((line, i) => (i === idx ? { ...line, [key]: value } : line)))

  const usedMetals = new Set(lines.map((l) => l.metal))
  const available = metalOptions.filter((m) => !usedMetals.has(m))
  const canAddMetal = available.length > 0 && lines.length < MAX_BATCH_LINES

  const addMetal = (metal: string) => {
    setLines((current) => [...current, { metal, qty: '', purity: '', time: '' }])
    setPicking(false)
  }

  const send = async () => {
    if (busy || !canSend) return
    if (pickSender && !effectiveSender) {
      setError('Choose who is sending this batch.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Time is not typed: blank times are stamped with the moment the batch is sent.
      const err = await onSend({ ...choice, lines: lines.map((line) => ({ ...line, time: '' })) }, effectiveSender)
      if (err) setError(err)
      else onClose()
    } finally {
      setBusy(false)
    }
  }

  const sendDisabled = !canSend || busy || (pickSender && !effectiveSender)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <View style={styles.titleBar}>
            <Text style={styles.title}>{title}</Text>
            {batchOptions.length <= 1 ? <Text style={styles.batchBadge}>{choiceTitle(choice)}</Text> : null}
          </View>
          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            bottomOffset={FOOTER_HEIGHT}
            contentContainerStyle={styles.content}
          >
            {pickSender ? (
              <View style={styles.batchPick}>
                <Text style={styles.label}>Sent by</Text>
                <View style={styles.chips}>
                  {senders.map((s) => {
                    const on = s.id === effectiveSender
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Sent by ${s.name}`}
                        accessibilityState={{ selected: on }}
                        disabled={busy}
                        onPress={() => setSenderId(s.id)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}
            {batchOptions.length > 1 ? (
              <View style={styles.batchPick}>
                <Text style={styles.label}>Batch (Metal In batches not closed yet)</Text>
                <View style={styles.chips}>
                  {batchOptions.map((option) => {
                    const on = sameChoice(option, choice)
                    return (
                      <Pressable
                        key={`${option.entryDate}|${option.batchLabel}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setChoice(option)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{choiceTitle(option)}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.gridRow, styles.gridHeader]}>
              <Text style={[styles.headCell, styles.colMetal]}>Metal</Text>
              <Text style={[styles.headCell, styles.colField]}>Qty</Text>
              <Text style={[styles.headCell, styles.colField]}>Purity</Text>
              <Text style={[styles.headCell, styles.colField]}>Time</Text>
              <View style={styles.colRemove} />
            </View>
            {lines.map((line, idx) => (
              <View key={`${line.metal}-${idx}`} style={styles.gridRow}>
                <Text style={[styles.metalText, styles.colMetal]}>{line.metal}</Text>
                <TextInput
                  accessibilityLabel={`${title} ${line.metal} Qty`}
                  style={[styles.input, styles.colField]}
                  value={line.qty}
                  onChangeText={(v) => setField(idx, 'qty', cleanNumberInput(v, QTY_MAX_LENGTH))}
                  placeholder="0.000"
                  placeholderTextColor={td.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={QTY_MAX_LENGTH}
                  autoFocus={idx === 0}
                  editable={!busy}
                />
                <TextInput
                  accessibilityLabel={`${title} ${line.metal} Purity`}
                  style={[styles.input, styles.colField]}
                  value={line.purity}
                  onChangeText={(v) => setField(idx, 'purity', cleanNumberInput(v, PURITY_MAX_LENGTH))}
                  placeholder="--"
                  placeholderTextColor={td.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={PURITY_MAX_LENGTH}
                  editable={!busy}
                />
                <View
                  accessible
                  accessibilityLabel={`${title} ${line.metal} Time ${now}`}
                  style={[styles.input, styles.clock, styles.colField]}
                >
                  <Text style={styles.clockText}>{now}</Text>
                </View>
                <View style={styles.colRemove}>
                  {lines.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${line.metal}`}
                      hitSlop={8}
                      disabled={busy}
                      onPress={() => setLines((current) => current.filter((_, i) => i !== idx))}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {canAddMetal ? (
              picking ? (
                <View style={styles.picker}>
                  <Text style={styles.label}>Choose a metal</Text>
                  <View style={styles.chips}>
                    {available.map((metal) => (
                      <Pressable key={metal} accessibilityRole="button" onPress={() => addMetal(metal)} style={styles.chip}>
                        <Text style={styles.chipText}>{metal}</Text>
                      </Pressable>
                    ))}
                    <Pressable accessibilityRole="button" onPress={() => setPicking(false)} style={styles.chipGhost}>
                      <Text style={styles.chipGhostText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPicking(true)}
                  disabled={busy}
                  style={styles.addMetal}
                >
                  <Text style={styles.addMetalText}>+ Add metal</Text>
                </Pressable>
              )
            ) : null}

            <Text style={styles.help}>Time is set automatically when you tap Save & send.</Text>
          </KeyboardAwareScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!canSend && hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: sendDisabled, busy }}
            disabled={sendDisabled}
            onPress={send}
            style={({ pressed }) => [styles.confirm, { opacity: sendDisabled ? 0.45 : pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.confirmText}>{busy ? 'SENDING…' : 'SAVE & SEND TO F.M'}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose} disabled={busy}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: td.white,
    borderRadius: td.radius,
    borderWidth: 1,
    borderColor: td.border,
    padding: 16,
    zIndex: 1,
  },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: td.text, fontWeight: '800', fontSize: 20 },
  batchBadge: {
    color: td.orange,
    fontWeight: '800',
    fontSize: 16,
    backgroundColor: td.cream,
    borderRadius: td.radius,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  content: { paddingBottom: 4 },
  batchPick: { marginBottom: 12 },
  label: { color: td.textMuted, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: td.orange,
    backgroundColor: td.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: td.orange },
  chipText: { color: td.orange, fontWeight: '700', fontSize: 15 },
  chipTextOn: { color: td.white },
  chipGhost: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipGhostText: { color: td.textMuted, fontWeight: '700', fontSize: 15 },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
  },
  gridHeader: { backgroundColor: td.cream, paddingHorizontal: 4 },
  headCell: { color: td.textMuted, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  colMetal: { flex: 1.1, textAlign: 'left' },
  colField: { flex: 1 },
  colRemove: { width: 32, alignItems: 'center' },
  metalText: { color: td.text, fontWeight: '700', fontSize: 16, paddingLeft: 4 },
  input: {
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 46,
    color: td.text,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    minWidth: 0,
  },
  clock: {
    backgroundColor: '#F3F4F6',
    borderColor: td.borderGrid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockText: { color: td.textMuted, fontWeight: '700', fontSize: 16 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: td.textMuted, fontWeight: '800', fontSize: 16 },
  picker: { marginTop: 12 },
  addMetal: {
    marginTop: 12,
    minHeight: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: td.orange,
    borderRadius: td.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMetalText: { color: td.orange, fontWeight: '800', fontSize: 15 },
  help: { color: td.textMuted, fontSize: 12, marginTop: 10 },
  error: { color: '#B91C1C', fontSize: 14, fontWeight: '600', marginTop: 10 },
  hint: { color: td.textMuted, fontSize: 13, marginTop: 10, textAlign: 'center' },
  confirm: {
    backgroundColor: td.orange,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
    marginTop: 12,
    marginBottom: 8,
  },
  confirmText: { color: td.white, fontWeight: '800', fontSize: 17, letterSpacing: 0.4 },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
  },
  cancelText: { color: td.text, fontWeight: '700' },
})
