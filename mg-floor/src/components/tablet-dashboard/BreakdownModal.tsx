import React from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import type { BreakdownStatus } from '@/src/api/floor'
import { floorDepartmentLabel } from '@/src/config/floorDepartments'
import { formatClock } from './metalMapping'
import type { BreakdownPhase } from './useBreakdown'

type Props = {
  visible: boolean
  phase: BreakdownPhase
  alert: BreakdownStatus | null
  error: string
  department: string
  onRetry: () => void
  onClose: () => void
}

export function BreakdownModal({ visible, phase, alert, error, department, onRetry, onClose }: Props) {
  const departmentName = floorDepartmentLabel(alert?.department || department) || '—'

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

          {phase === 'acknowledged' && alert ? (
            <View style={styles.okBox}>
              <Text style={styles.okTitle}>F.M acknowledged</Text>
              <Text style={styles.okBody}>
                {alert.acknowledgedByName || 'Floor Manager'}
                {alert.acknowledgedAt ? ` at ${formatClock(alert.acknowledgedAt)}` : ''} saw the breakdown.
              </Text>
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
