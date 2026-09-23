import React, { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { tabletDashboard as td } from '@/src/theme'
import { callFloorManager } from '@/src/api/floor'
import { createOperationId } from '@/src/offline/outbox'
import { userFacingMessage } from '@/src/api/errors'
import type { AssignedManager } from '@/src/auth/floorDashboardPrefs'

type Props = {
  visible: boolean
  onClose: () => void
  department: string
  operatorName: string
  operatorId: string
  manager: AssignedManager | null
}

export function CallFMModal({
  visible,
  onClose,
  department,
  operatorName,
  operatorId,
  manager,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const call = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        setError('Network unavailable — try again when online.')
        return
      }
      await callFloorManager({
        title: `Floor assistance — ${department || 'floor'}`,
        message: `Operator ${operatorName || 'unknown'} (${operatorId || ''}) needs assistance.${
          manager ? ` Assigned manager: ${manager.name}.` : ''
        }`,
        department: department || '',
        operationId: createOperationId('floor_alert'),
      })
      setDone(true)
    } catch (err) {
      setError(userFacingMessage(err) || 'Unable to raise alert')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    setDone(false)
    setError('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Call F.M</Text>
          {done ? (
            <>
              <Text style={styles.ok}>Floor manager alerted.</Text>
              <Pressable style={styles.confirm} onPress={close}>
                <Text style={styles.confirmText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.meta}>Department: {department || '—'}</Text>
              <Text style={styles.meta}>Operator: {operatorName || '—'}</Text>
              <Text style={styles.meta}>Manager: {manager?.name || 'Not assigned'}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.confirm, busy && styles.disabled]}
                onPress={call}
                disabled={busy}
              >
                <Text style={styles.confirmText}>{busy ? 'Calling…' : 'Confirm Call'}</Text>
              </Pressable>
              <Pressable style={styles.cancel} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
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
  ok: { color: td.text, fontWeight: '700', fontSize: 16, marginVertical: 8 },
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
