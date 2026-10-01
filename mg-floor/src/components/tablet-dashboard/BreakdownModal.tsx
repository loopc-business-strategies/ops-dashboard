import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import type { BreakdownStatus } from '@/src/api/floor'
import { floorDepartmentLabel } from '@/src/config/floorDepartments'
import { formatClock } from './metalMapping'
import { FIX_NOTE_MAX, formatDowntime, type BreakdownPhase } from './breakdown'

type Props = {
  visible: boolean
  phase: BreakdownPhase
  alert: BreakdownStatus | null
  error: string
  fixError: string
  department: string
  onRetry: () => void
  onFix: (note: string) => void
  onClose: () => void
}

export function BreakdownModal({
  visible,
  phase: livePhase,
  alert: liveAlert,
  error: liveError,
  fixError,
  department,
  onRetry,
  onFix,
  onClose,
}: Props) {
  // Closing clears a fixed breakdown, so keep the last view while the modal fades out.
  const shown = useRef({ phase: livePhase, alert: liveAlert, error: liveError })
  if (visible) shown.current = { phase: livePhase, alert: liveAlert, error: liveError }
  const { phase, alert, error } = shown.current
  const [note, setNote] = useState('')
  const departmentName = floorDepartmentLabel(alert?.department || department) || '—'
  const canFix = (phase === 'waiting' || phase === 'acknowledged' || phase === 'fixing') && alert

  useEffect(() => {
    if (livePhase === 'fixed' || livePhase === 'idle') setNote('')
  }, [livePhase])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Breakdown</Text>
          <Text style={styles.meta}>Department: {departmentName}</Text>

          {phase === 'sending' ? (
            <View style={styles.row}>
              <ActivityIndicator color={td.red} />
              <Text style={styles.meta}>Sending breakdown…</Text>
            </View>
          ) : null}

          {phase === 'waiting' && alert ? (
            <View style={styles.alarmBox}>
              <Text style={styles.alarmTitle}>Breakdown reported</Text>
              <Text style={styles.alarmBody}>
                Waiting for F.M — the Production Dashboard is alarming. Reported at {formatClock(alert.createdAt)}.
              </Text>
            </View>
          ) : null}

          {(phase === 'acknowledged' || (phase === 'fixing' && alert?.status === 'ACKNOWLEDGED')) && alert ? (
            <View style={styles.okBox}>
              <Text style={styles.okTitle}>F.M acknowledged</Text>
              <Text style={styles.okBody}>
                {alert.acknowledgedByName || 'Floor Manager'}
                {alert.acknowledgedAt ? ` at ${formatClock(alert.acknowledgedAt)}` : ''} saw the breakdown.
                {' '}Machine down since {formatClock(alert.createdAt)}.
              </Text>
            </View>
          ) : null}

          {canFix ? (
            <View style={styles.fixBox}>
              <Text style={styles.fixLabel}>When the machine works again:</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What was wrong / what was fixed? (optional)"
                placeholderTextColor={td.textMuted}
                maxLength={FIX_NOTE_MAX}
                editable={phase !== 'fixing'}
                style={styles.input}
              />
              {fixError ? <Text style={styles.error}>{fixError}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Machine fixed"
                disabled={phase === 'fixing'}
                style={({ pressed }) => [styles.fixBtn, (pressed || phase === 'fixing') && styles.fixBtnPressed]}
                onPress={() => onFix(note)}
              >
                {phase === 'fixing' ? <ActivityIndicator color={td.white} /> : <Text style={styles.fixBtnText}>MACHINE FIXED</Text>}
              </Pressable>
            </View>
          ) : null}

          {phase === 'fixed' && alert ? (
            <View style={styles.okBox}>
              <Text style={styles.okTitle}>Machine fixed</Text>
              <Text style={styles.okBody}>
                Down for {formatDowntime(alert.downtimeMinutes)}
                {alert.resolvedByName ? ` · marked fixed by ${alert.resolvedByName}` : ''}
                {alert.resolvedAt ? ` at ${formatClock(alert.resolvedAt)}` : ''}.
              </Text>
              {alert.fixNote ? <Text style={styles.okBody}>Note: {alert.fixNote}</Text> : null}
            </View>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable accessibilityRole="button" style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: td.white,
    borderRadius: td.radius,
    borderWidth: 2,
    borderColor: td.red,
    padding: 16,
    zIndex: 1,
    gap: 8,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  title: { color: td.red, fontWeight: '800', fontSize: 20, marginBottom: 4 },
  meta: { color: td.text, fontWeight: '600', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  alarmBox: {
    backgroundColor: td.redSoft,
    borderWidth: 1,
    borderColor: td.red,
    borderRadius: td.radius,
    padding: 12,
    marginTop: 4,
  },
  alarmTitle: { color: td.red, fontWeight: '800', fontSize: 18 },
  alarmBody: { color: td.text, fontSize: 14, marginTop: 4 },
  okBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: td.radius,
    padding: 12,
    marginTop: 4,
  },
  okTitle: { color: '#15803D', fontWeight: '800', fontSize: 18 },
  okBody: { color: td.text, fontSize: 14, marginTop: 4 },
  fixBox: { gap: 8, marginTop: 6 },
  fixLabel: { color: td.text, fontWeight: '700', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: td.text,
    backgroundColor: td.white,
  },
  fixBtn: {
    backgroundColor: '#16A34A',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
  },
  fixBtnPressed: { backgroundColor: '#15803D' },
  fixBtnText: { color: td.white, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  error: { color: td.red, fontWeight: '600' },
  retry: {
    backgroundColor: td.red,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
  },
  retryText: { color: td.white, fontWeight: '800', fontSize: 16 },
  close: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    marginTop: 4,
  },
  closeText: { color: td.text, fontWeight: '700' },
})
