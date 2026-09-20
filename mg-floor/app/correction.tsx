import React, { useState } from 'react'
import { Alert, StyleSheet, Text, TextInput } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { correctWeight } from '@/src/api/floor'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { colors, spacing } from '@/src/theme'

/**
 * Supervisor-only weight correction.
 * Preserves original via backend WeightAdjustment (originalValue + newValue + reason).
 */
export default function CorrectionScreen() {
  const { permissions } = useAuth()
  const [batchId, setBatchId] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!permissions.adjustWeight) {
    return (
      <Screen>
        <Subtitle>Not authorized — supervisor / production manager only</Subtitle>
      </Screen>
    )
  }

  const submit = async () => {
    const adj = Number(adjustment)
    if (!batchId.trim() || !Number.isFinite(adj) || adj === 0 || reason.trim().length < 3) {
      Alert.alert('Invalid', 'Batch ID, non-zero adjustment, and reason (min 3 chars) required')
      return
    }
    setBusy(true)
    const operationId = createOperationId('weight_adj')
    const payload = {
      batchId: batchId.trim(),
      adjustment: adj,
      reason: reason.trim(),
      field: 'currentWeight',
      operationId,
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'weight_adjust', payload })
        Alert.alert('Saved offline', 'Correction queued for sync')
        return
      }
      await correctWeight(payload)
      Alert.alert('Recorded', 'Correction saved with original value preserved in audit')
      setAdjustment('')
      setReason('')
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'weight_adjust', payload })
      Alert.alert('Queued', err instanceof Error ? err.message : 'Correction queued offline')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Subtitle>Emergency weight correction — never silently overwrites history</Subtitle>
      <Text style={styles.label}>Batch ID</Text>
      <TextInput style={styles.input} value={batchId} onChangeText={setBatchId} placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Adjustment (delta grams)</Text>
      <TextInput style={styles.input} value={adjustment} onChangeText={setAdjustment} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Reason</Text>
      <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholderTextColor={colors.textMuted} />
      <BigButton label={busy ? 'SAVING…' : 'SUBMIT CORRECTION'} onPress={submit} disabled={busy} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, marginTop: spacing.md, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 14,
    fontSize: 18,
  },
})
