import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { fetchDepartments, fetchScales, transfer } from '@/src/api/floor'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { colors, spacing } from '@/src/theme'

export default function TransferScreen() {
  const params = useLocalSearchParams<{ batchId?: string }>()
  const [batchId, setBatchId] = useState(String(params.batchId || ''))
  const [fromDepartment, setFromDepartment] = useState('')
  const [toDepartment, setToDepartment] = useState('')
  const [departments, setDepartments] = useState<Array<{ key: string; label: string }>>([])
  const [scaleId, setScaleId] = useState('')
  const [scaleOptions, setScaleOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = useLiveScale(scaleId)

  useEffect(() => {
    if (params.batchId) setBatchId(String(params.batchId))
  }, [params.batchId])

  useEffect(() => {
    fetchDepartments()
      .then((r) => setDepartments(r.departments || []))
      .catch(() => {})
    fetchScales()
      .then((s) => {
        const ids = (s.scales || []).map((x) => String(x.scaleId))
        setScaleOptions(ids)
        if (ids[0]) setScaleId(ids[0])
      })
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!batchId.trim() || !toDepartment.trim()) {
      Alert.alert('Missing data', 'Batch ID and destination required')
      return
    }
    if (!live?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight')
      return
    }
    setBusy(true)
    setError('')
    const operationId = createOperationId('transfer')
    const payload = {
      batchId: batchId.trim(),
      fromDepartment: fromDepartment.trim() || undefined,
      toDepartment: toDepartment.trim(),
      scaleId,
      weight: live.weight,
      operationId,
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'transfer', payload, scaleId })
        Alert.alert('Saved offline', 'Transfer queued')
        return
      }
      await transfer(payload)
      Alert.alert('Success', 'Transfer recorded')
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'transfer', payload, scaleId })
      setError(err instanceof Error ? err.message : 'Failed — queued offline')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView>
        <Subtitle>Department → department material transfer</Subtitle>
        <Text style={styles.label}>Batch ID</Text>
        <TextInput style={styles.input} value={batchId} onChangeText={setBatchId} placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>From department</Text>
        <TextInput style={styles.input} value={fromDepartment} onChangeText={setFromDepartment} placeholder="auto from batch if empty" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>To department</Text>
        <TextInput style={styles.input} value={toDepartment} onChangeText={setToDepartment} placeholderTextColor={colors.textMuted} />
        {departments.length ? (
          <Text style={styles.hint}>{departments.map((d) => d.key).join(' → ')}</Text>
        ) : null}
        <Text style={styles.label}>Scale</Text>
        {scaleOptions.map((id) => (
          <BigButton
            key={id}
            label={id === scaleId ? `✓ ${id}` : id}
            tone={id === scaleId ? 'accent' : 'neutral'}
            onPress={() => setScaleId(id)}
          />
        ))}
        <WeightDisplay weight={live?.weight ?? null} stable={live?.stable ?? null} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <BigButton label={busy ? 'SUBMITTING…' : 'CAPTURE & SUBMIT TRANSFER'} onPress={submit} disabled={busy || !live?.stable} />
      </ScrollView>
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
  hint: { color: colors.textMuted, marginTop: 8 },
  error: { color: colors.danger, marginVertical: 8, fontWeight: '600' },
})
