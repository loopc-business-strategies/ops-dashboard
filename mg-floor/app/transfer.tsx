import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { fetchDepartments, fetchScales, transfer } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { colors, spacing } from '@/src/theme'

export default function TransferScreen() {
  const params = useLocalSearchParams<{ batchId?: string; scaleId?: string }>()
  const { user } = useAuth()
  const [batchId, setBatchId] = useState(String(params.batchId || ''))
  const [fromDepartment, setFromDepartment] = useState('')
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [showManualBatch, setShowManualBatch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const capture = useStableScaleCapture(scaleId)

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
    useCallback(
      async (signal) => {
        const s = await fetchScales(
          {
            limit: 50,
            skip: 0,
            ...(user?.department ? { department: String(user.department) } : {}),
          },
          { signal },
        )
        return (s.scales || []).map((x) => String(x.scaleId))
      },
      [user?.department],
    ),
    { isEmpty: (d) => !d.length, cacheKey: `mg-floor:scale-ids:${user?.department || 'all'}` },
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
    if (!capture.captured?.scaleReadingId) {
      Alert.alert('Capture stable weight', 'Capture a stable scale reading before confirming.')
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
      stableReadingId: capture.captured.scaleReadingId,
      weight: capture.captured.weight,
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
      capture.clearCapture()
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
        <Subtitle>Scan → departments → capture stable → confirm transfer</Subtitle>

        <QrFirstResolve
          hint="Scan batch / transfer QR"
          onVerified={(match) => {
            const id = String(match.batchId || match._id || match.id || '')
            if (id) setBatchId(id)
            const from = String(match.fromDepartment || match.currentDepartment || match.department || '')
            const to = String(match.toDepartment || '')
            if (from) setFromDepartment(from)
            if (to) setToDepartment(to)
          }}
        />

        {batchId ? <Text style={styles.selected}>Batch: {batchId}</Text> : null}

        <BigButton
          label={showManualBatch ? 'HIDE MANUAL BATCH' : 'ENTER BATCH ID (FALLBACK)'}
          tone="neutral"
          onPress={() => setShowManualBatch((v) => !v)}
        />
        {showManualBatch ? (
          <>
            <Text style={styles.warn}>Manual batch ID still validated by backend on submit.</Text>
            <TextInput
              style={styles.input}
              value={batchId}
              onChangeText={setBatchId}
              placeholderTextColor={colors.textMuted}
            />
          </>
        ) : null}

        <Text style={styles.step}>DEPARTMENTS</Text>
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

        <Text style={styles.step}>AUTHORIZED SCALE</Text>
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

        <Text style={styles.step}>STABLE CAPTURE</Text>
        <StableCapturePanel scaleId={scaleId} capture={capture} busy={busy} />

        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CONFIRM TRANSFER'}
          onPress={submit}
          disabled={busy || !scaleId || !capture.hasCapture}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  step: { color: colors.accent, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },
  selected: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  warn: { color: colors.warning, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
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
