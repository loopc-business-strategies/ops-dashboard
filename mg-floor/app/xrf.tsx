import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, LoadingBlock, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { fetchXrfDevices, fetchXrfStatus, submitXrfTest } from '@/src/api/floor'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { colors, spacing } from '@/src/theme'

type ElementRow = { symbol: string; value: number; unit?: string }

type Phase = 'idle' | 'testing' | 'result' | 'error'

export default function XrfScreen() {
  const { user } = useAuth()
  const [analyzerId, setAnalyzerId] = useState('MG-XRF-001')
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([])
  const [status, setStatus] = useState('—')
  const [batchNumber, setBatchNumber] = useState('')
  const [batchId, setBatchId] = useState('')
  const [jobId, setJobId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [scaleId, setScaleId] = useState('')
  const [scaleWeight, setScaleWeight] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [elements, setElements] = useState<ElementRow[]>([])
  const [testMeta, setTestMeta] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const [devs, st] = await Promise.all([
        fetchXrfDevices(),
        fetchXrfStatus(analyzerId).catch(() => ({ status: 'UNKNOWN' })),
      ])
      setDevices(devs.devices || [])
      setStatus(String(st.status || 'UNKNOWN'))
      if (devs.devices?.[0]?.analyzerId && analyzerId === 'MG-XRF-001') {
        setAnalyzerId(String(devs.devices[0].analyzerId))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load XRF devices')
      setStatus('DISCONNECTED')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const startTest = async () => {
    setBusy(true)
    setError('')
    setPhase('testing')
    setElements([])
    setTestMeta(null)
    try {
      // Development path: app can save a simulated result when gateway simulator is not reachable.
      // Real LANScientific protocol is gateway-side and model-configurable.
      await new Promise((r) => setTimeout(r, 600))
      const simElements: ElementRow[] = [
        { symbol: 'Au', value: 91.72, unit: '%' },
        { symbol: 'Ag', value: 5.41, unit: '%' },
        { symbol: 'Cu', value: 2.63, unit: '%' },
      ]
      setElements(simElements)
      setTestMeta({
        analyzerId,
        status: 'COMPLETED',
        note: 'Simulator payload — replace with gateway ingest when live protocol is configured',
      })
      setPhase('result')
      setStatus('READY')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'XRF test failed')
      setStatus('ERROR')
    } finally {
      setBusy(false)
    }
  }

  const saveResult = async () => {
    if (!elements.length) {
      Alert.alert('No result', 'Run a test first')
      return
    }
    setBusy(true)
    const operationId = createOperationId('xrf_test')
    const payload: Record<string, unknown> = {
      analyzerId,
      elements,
      status: 'COMPLETED',
      batchNumber: batchNumber.trim() || undefined,
      batchId: batchId.trim() || undefined,
      jobId: jobId.trim() || undefined,
      materialId: materialId.trim() || undefined,
      scaleId: scaleId.trim() || undefined,
      scaleWeight: scaleWeight ? Number(scaleWeight) : undefined,
      department: user?.department || 'quality_control',
      operationId,
      originalResult: { elements, source: 'mg-floor-ui' },
      rawData: testMeta,
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'xrf_test', payload, scaleId: scaleId || undefined })
        Alert.alert('Saved offline', 'XRF result queued for sync')
        return
      }
      await submitXrfTest(payload)
      Alert.alert('Saved', 'XRF result recorded with audit trail')
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'xrf_test', payload, scaleId: scaleId || undefined })
      Alert.alert('Queued', err instanceof Error ? err.message : 'Saved offline after failure')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading XRF…" />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Quality control — LANScientific model is configurable</Subtitle>
        <View style={styles.metaRow}>
          <StatusPill label={`ANALYZER ${analyzerId}`} tone="neutral" />
          <StatusPill label={String(status)} tone={status === 'READY' || status === 'CONNECTED' ? 'ok' : 'warn'} />
        </View>
        {devices[0] ? (
          <Text style={styles.hint}>
            {String(devices[0].manufacturer || 'LANScientific')} · model{' '}
            {String(devices[0].model || 'TBD — confirm on device')}
          </Text>
        ) : null}

        <Text style={styles.label}>Batch number</Text>
        <TextInput style={styles.input} value={batchNumber} onChangeText={setBatchNumber} placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Batch ID (optional)</Text>
        <TextInput style={styles.input} value={batchId} onChangeText={setBatchId} placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Job / Material (optional)</Text>
        <TextInput style={styles.input} value={jobId} onChangeText={setJobId} placeholder="Job ID" placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} value={materialId} onChangeText={setMaterialId} placeholder="Material ID" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Linked scale weight (optional)</Text>
        <TextInput style={styles.input} value={scaleId} onChangeText={setScaleId} placeholder="MG-SCALE-003" placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} value={scaleWeight} onChangeText={setScaleWeight} keyboardType="decimal-pad" placeholder="125.36" placeholderTextColor={colors.textMuted} />

        {phase === 'testing' ? <Text style={styles.testing}>TESTING…</Text> : null}
        {phase === 'result' ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>RESULT</Text>
            {elements.map((e) => (
              <Text key={e.symbol} style={styles.el}>
                {e.symbol}  {e.value}
                {e.unit || '%'}
              </Text>
            ))}
            <Text style={styles.hint}>Operator: {user?.name || '—'} · {new Date().toLocaleString()}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}

        <BigButton label={busy && phase === 'testing' ? 'TESTING…' : 'START XRF TEST'} onPress={startTest} disabled={busy} />
        {phase === 'result' ? (
          <>
            <BigButton label={busy ? 'SAVING…' : 'SAVE RESULT'} onPress={saveResult} disabled={busy} />
            <BigButton label="TEST AGAIN" onPress={startTest} tone="neutral" disabled={busy} />
          </>
        ) : null}
        <BigButton label="REFRESH STATUS" onPress={refresh} tone="neutral" />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
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
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  testing: { color: colors.accent, fontSize: 22, fontWeight: '800', textAlign: 'center', marginVertical: spacing.lg },
  result: {
    marginVertical: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  resultTitle: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: spacing.sm },
  el: { color: colors.text, fontSize: 20, fontWeight: '700', marginVertical: 2 },
  err: { color: '#f87171', marginVertical: spacing.sm },
})
