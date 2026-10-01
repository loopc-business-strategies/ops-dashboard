import React, { useRef } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'
import type { AlarmStatus } from '@/src/api/floor'
import { createOperationId } from '@/src/offline/outbox'
import { floorDepartmentLabel } from '@/src/config/floorDepartments'
import type { AssignedManager } from '@/src/auth/floorDashboardPrefs'
import { formatClock } from './metalMapping'
import type { FmCallPhase } from './fmCall'

type Props = {
  visible: boolean
  onClose: () => void
  department: string
  operatorName: string
  manager: AssignedManager | null
  phase: FmCallPhase
  alert: AlarmStatus | null
  error: string
  onCall: (body: Record<string, unknown>) => void
}

export function CallFMModal({
  visible,
  onClose,
  department,
  operatorName,
  manager,
  phase: livePhase,
  alert: liveAlert,
  error: liveError,
  onCall,
}: Props) {
  const departmentName = floorDepartmentLabel(department)
  // Closing resets the call, so keep the last view while the modal fades out.
  const shown = useRef({ phase: livePhase, alert: liveAlert, error: liveError })
  if (visible) shown.current = { phase: livePhase, alert: liveAlert, error: liveError }
  const { phase, alert, error } = shown.current
  const asking = phase === 'idle' || phase === 'error' || phase === 'sending'

  const call = () => {
    if (livePhase === 'sending') return
    onCall({
      title: `Floor assistance — ${departmentName || 'floor'}`,
      message: `Operator ${operatorName || 'unknown'} needs assistance.${
        manager ? ` Assigned manager: ${manager.name}.` : ''
      }`,
      department: department || '',
      operationId: createOperationId('floor_alert'),
    })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Call F.M</Text>

          {phase === 'waiting' && alert ? (
            <View style={styles.waitBox}>
              <View style={styles.row}>
                <ActivityIndicator color={td.orange} />
                <Text style={styles.waitTitle}>Waiting for F.M</Text>
              </View>
              <Text style={styles.boxBody}>
                Floor manager alerted at {formatClock(alert.createdAt)} — the Production Dashboard is ringing.
              </Text>
            </View>
          ) : null}

          {phase === 'coming' && alert ? (
            <View style={styles.okBox}>
              <Text style={styles.okTitle}>F.M is coming</Text>
              <Text style={styles.boxBody}>
                {alert.acknowledgedByName || 'Floor Manager'}
                {alert.acknowledgedAt ? ` saw your call at ${formatClock(alert.acknowledgedAt)}` : ' saw your call'}.
              </Text>
            </View>
          ) : null}

          {asking ? (
            <>
              <Text style={styles.meta}>Department: {departmentName || '—'}</Text>
              <Text style={styles.meta}>Operator: {operatorName || '—'}</Text>
              <Text style={styles.meta}>Manager: {manager?.name || 'Not assigned'}</Text>
              {phase === 'error' && error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                style={[styles.confirm, phase === 'sending' && styles.disabled]}
                onPress={call}
                disabled={phase === 'sending'}
              >
                <Text style={styles.confirmText}>{phase === 'sending' ? 'Calling…' : 'Confirm Call'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" style={styles.confirm} onPress={onClose}>
              <Text style={styles.confirmText}>{phase === 'coming' ? 'Done' : 'Close'}</Text>
            </Pressable>
          )}
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
    borderWidth: 1,
    borderColor: td.border,
    padding: 16,
    zIndex: 1,
    gap: 8,
  },
  title: { color: td.text, fontWeight: '800', fontSize: 18, marginBottom: 8 },
  meta: { color: td.text, fontWeight: '600', fontSize: 15 },
  error: { color: '#DC2626', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waitBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: td.orange,
    borderRadius: td.radius,
    padding: 12,
  },
  waitTitle: { color: td.orange, fontWeight: '800', fontSize: 18 },
  okBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: td.radius,
    padding: 12,
  },
  okTitle: { color: '#15803D', fontWeight: '800', fontSize: 20 },
  boxBody: { color: td.text, fontSize: 14, marginTop: 4 },
  confirm: {
    backgroundColor: td.orange,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
    marginTop: 8,
  },
  confirmText: { color: td.white, fontWeight: '800', fontSize: 16 },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
  },
  cancelText: { color: td.text, fontWeight: '700' },
  disabled: { opacity: 0.45 },
})
