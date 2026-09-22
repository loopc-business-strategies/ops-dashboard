import React, { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { Screen, Subtitle, Title, BigButton } from '@/src/components/ui'
import { useAuth } from '@/src/context/AuthContext'
import { callFloorManager } from '@/src/api/floor'
import { getSelectedDepartment } from '@/src/auth/sessionPrefs'
import { createOperationId } from '@/src/offline/outbox'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

export default function CallManagerScreen() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)

  const call = async () => {
    const dept = (await getSelectedDepartment()) || user?.department || ''
    Alert.alert('CALL FLOOR MANAGER?', `Department: ${dept}\nOperator: ${user?.name || '—'}`, [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'CALL',
        onPress: async () => {
          if (busy) return
          setBusy(true)
          try {
            const net = await NetInfo.fetch()
            if (!net.isConnected) {
              Alert.alert('Offline', 'Network unavailable')
              return
            }
            await callFloorManager({
              title: `Floor assistance — ${dept || 'floor'}`,
              message: `Operator ${user?.name || 'unknown'} needs assistance.`,
              department: dept,
              operationId: createOperationId('floor_alert'),
            })
            Alert.alert('FLOOR MANAGER ALERTED')
          } catch (err) {
            Alert.alert('Call failed', userFacingMessage(err) || 'Unable to raise alert')
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <Title>Call Floor Manager</Title>
      <Subtitle>Need assistance on the floor?</Subtitle>
      <View style={styles.box}>
        <Text style={styles.meta}>Department: {(user?.department || '—').toString()}</Text>
        <Text style={styles.meta}>Operator: {user?.name || '—'}</Text>
        <BigButton label={busy ? 'CALLING…' : 'CALL FLOOR MANAGER'} onPress={call} disabled={busy} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  box: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { color: colors.textMuted, marginBottom: spacing.sm, fontWeight: '600' },
})
