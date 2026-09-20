import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import { fetchDepartments, fetchScales, transfer } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { colors, spacing } from '@/src/theme'

export default function TransferScreen() {
  const params = useLocalSearchParams<{ batchId?: string; scaleId?: string }>()
  const [batchId, setBatchId] = useState(String(params.batchId || ''))
  const [fromDepartment, setFromDepartment] = useState('')
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const live = useLiveScale(scaleId || null)

  useEffect(() => {
    if (params.batchId) setBatchId(String(params.batchId))
  }, [params.batchId])

  useEffect(() => {
    if (params.scaleId) setScaleId(String(params.scaleId))
  }, [params.scaleId])

  const departments = useAsyncResource(
    useCallback(async (signal) => {
      const r = await fetchDepartments({ signal })
      return r.departments || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:departments' },
  )

  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const s = await fetchScales({ limit: 50, skip: 0 }, { signal })
      return (s.scales || []).map((x) => String(x.scaleId))
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:scale-ids' },
  )

  const submit = async () => {
    if (!batchId.trim() || !toDepartment.trim()) {
      Alert.alert('Missing data', 'Batch ID and destination required')
      return
    }
    if (!scaleId) {
      Alert.alert('Select a scale', 'Choose an authorized scale before submitting.')
      return
    }
    if (!live.lastReading?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight')
      return
    }
    if (busy) return
    setBusy(true)
    setSubmitError('')
    const operationId = inFlightOpId.current || createOperationId('transfer')
    inFlightOpId.current = operationId
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
        inFlightOpId.current = null
        return
      }
      await transfer(payload)
      Alert.alert('Success', 'Transfer recorded')
      inFlightOpId.current = null
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'transfer', payload, scaleId })
      setSubmitError(err instanceof Error ? err.message : 'Failed — queued offline')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Department → department material transfer</Subtitle>

        <Text style={styles.label}>Batch ID</Text>
        <TextInput
          style={styles.input}
          value={batchId}
          onChangeText={setBatchId}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.step}>Departments</Text>
        <AsyncSection
          status={departments.status}
          loadingLabel="Loading departments…"
          error={departments.error || 'Departments unavailable'}
          emptyMessage="No departments returned"
          onRetry={departments.reload}
        >
          <View style={styles.row}>
            {(departments.data || []).map((d) => (
              <BigButton
                key={d.key}
                label={toDepartment === d.key ? `✓ TO ${d.label}` : d.label}
                tone={toDepartment === d.key ? 'accent' : 'neutral'}
                onPress={() => setToDepartment(d.key)}
              />
            ))}
          </View>
        </AsyncSection>
        <TextInput
          style={styles.input}
          value={fromDepartment}
          onChangeText={setFromDepartment}
          placeholder="From (optional)"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={toDepartment}
          onChangeText={setToDepartment}
          placeholder="To department key"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.step}>Select scale</Text>
        {!scaleId ? <Text style={styles.hint}>Select a scale to start live weighing.</Text> : null}
        {scales.status === 'loading' && !scales.data ? <SectionLoading label="Loading scales…" /> : null}
        {scales.status === 'error' && !scales.data ? (
          <ErrorState message={scales.error || 'Scales unavailable'} onRetry={scales.reload} />
        ) : null}
        {(scales.data || []).map((id) => (
          <BigButton
            key={id}
            label={id === scaleId ? `✓ ${id}` : id}
            tone={id === scaleId ? 'accent' : 'neutral'}
            onPress={() => setScaleId(id)}
          />
        ))}

        <WeightDisplay
          weight={live.weight}
          stable={live.stable}
          connectionStatus={live.connectionStatus}
          lastReadingAt={live.lastReadingAt}
          onReconnect={live.reconnect}
        />

        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CONFIRM TRANSFER'}
          onPress={submit}
          disabled={busy || !scaleId || !live.stable}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  step: { color: colors.accent, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, marginBottom: spacing.sm },
  label: { color: colors.textMuted, marginTop: spacing.md, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 14,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  row: { gap: 0 },
  err: { color: colors.danger, marginVertical: spacing.sm },
})
