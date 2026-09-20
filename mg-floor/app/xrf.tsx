import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, LoadingBlock, Screen, StatusPill, Subtitle, WeightDisplay } from '@/src/components/ui'
import {
  captureStableReading,
  fetchScales,
  fetchXrfDevices,
  fetchXrfStatus,
  fetchXrfTests,
  submitXrfTest,
} from '@/src/api/floor'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { APP_ENV, IS_PRODUCTION } from '@/src/config/env'
import { colors, spacing } from '@/src/theme'

type ElementRow = { symbol: string; value: number; unit?: string }

type PendingTest = {
  xrfTestId: string
  ingestId?: string | null
  source?: string
  elements?: ElementRow[]
  analyzerId?: string
  testedAt?: string
}

type Phase = 'idle' | 'waiting' | 'result' | 'error'

const ALLOW_APP_SIM = !IS_PRODUCTION && APP_ENV !== 'production'

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
  const [scales, setScales] = useState<string[]>([])
  const [scaleReadingId, setScaleReadingId] = useState<string | null>(null)
  const [capturedWeight, setCapturedWeight] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [elements, setElements] = useState<ElementRow[]>([])
  const [pending, setPending] = useState<PendingTest | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const live = useLiveScale(scaleId)

  const applyPending = useCallback((test: PendingTest | null) => {
    if (!test) {
      setPending(null)
      setElements([])
      setPhase('waiting')
      return
    }
    setPending(test)
    setElements(Array.isArray(test.elements) ? test.elements : [])
    setPhase('result')
    if (test.analyzerId) setAnalyzerId(String(test.analyzerId))
  }, [])

  const loadPending = useCallback(async () => {
    const res = await fetchXrfTests({
      pendingForConfirm: '1',
      analyzerId,
      limit: 5,
    })
    const tests = (res.tests || []) as PendingTest[]
    const latest = tests[0] || null
    applyPending(latest)
    return latest
  }, [analyzerId, applyPending])

  const refresh = useCallback(async () => {
    try {
      const [devs, st, s] = await Promise.all([
        fetchXrfDevices(),
        fetchXrfStatus(analyzerId).catch(() => ({ status: 'UNKNOWN' })),
        fetchScales().catch(() => ({ scales: [] as Array<Record<string, unknown>> })),
      ])
      setDevices(devs.devices || [])
      setStatus(String(st.status || 'UNKNOWN'))
      const ids = (s.scales || []).map((x) => String(x.scaleId))
      setScales(ids)
      if (ids[0] && !scaleId) setScaleId(ids[0])
      if (devs.devices?.[0]?.analyzerId && analyzerId === 'MG-XRF-001') {
        setAnalyzerId(String(devs.devices[0].analyzerId))
      }
      await loadPending()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load XRF devices')
      setStatus('DISCONNECTED')
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }, [analyzerId, loadPending, scaleId])

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      loadPending().catch(() => {})
    }, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadPending])

  const clearCapture = () => {
    setScaleReadingId(null)
    setCapturedWeight(null)
  }

  const onSelectScale = (id: string) => {
    setScaleId(id)
    clearCapture()
  }

  const captureStable = async () => {
    if (!scaleId) {
      Alert.alert('Select scale', 'Pick a linked scale first')
      return
    }
    if (!live?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Place material on the scale and wait until STABLE.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await captureStableReading(scaleId, live.weight)
      setScaleReadingId(String(res.scaleReadingId))
      setCapturedWeight(Number(res.weight))
      Alert.alert('Captured', `Stable reading locked · ${Number(res.weight).toFixed(2)} g`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture stable reading')
    } finally {
      setBusy(false)
    }
  }

  const waitForGateway = async () => {
    setBusy(true)
    setError('')
    setPhase('waiting')
    try {
      const latest = await loadPending()
      if (!latest) {
        setError('Waiting for analyzer / gateway — no pending hardware result yet.')
      }
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Failed to poll pending XRF results')
    } finally {
      setBusy(false)
    }
  }

  const runSimulator = async () => {
    if (!ALLOW_APP_SIM) {
      Alert.alert('Not available', 'Simulator is disabled in production builds.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const simElements: ElementRow[] = [
        { symbol: 'Au', value: 91.72, unit: '%' },
        { symbol: 'Ag', value: 5.41, unit: '%' },
        { symbol: 'Cu', value: 2.63, unit: '%' },
      ]
      const operationId = createOperationId('xrf_sim')
      const payload: Record<string, unknown> = {
        source: 'simulated',
        analyzerId,
        elements: simElements,
        status: 'COMPLETED',
        batchNumber: batchNumber.trim() || undefined,
        batchId: batchId.trim() || undefined,
        jobId: jobId.trim() || undefined,
        materialId: materialId.trim() || undefined,
        scaleId: scaleId.trim() || undefined,
        scaleReadingId: scaleReadingId || undefined,
        department: user?.department || 'quality_control',
        operationId,
        originalResult: { elements: simElements, source: 'simulated' },
      }
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'xrf_test', payload, scaleId: scaleId || undefined })
        Alert.alert('Queued (SIMULATED)', 'Simulator XRF saved offline')
        return
      }
      const res = await submitXrfTest(payload)
      const test = (res.test || {}) as PendingTest
      applyPending({
        xrfTestId: String(test.xrfTestId || ''),
        source: 'simulated',
        elements: simElements,
        analyzerId,
      })
      Alert.alert('SIMULATED', 'Dev simulator result saved (tagged source=simulated)')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Simulator failed')
    } finally {
      setBusy(false)
    }
  }

  const saveResult = async () => {
    if (!pending?.xrfTestId) {
      Alert.alert('No result', 'Wait for a gateway-ingested result before confirming')
      return
    }
    if (pending.source === 'simulated' && !ALLOW_APP_SIM) {
      Alert.alert('Blocked', 'Simulated results cannot be confirmed in production')
      return
    }
    const isSim = pending.source === 'simulated'
    if (!isSim && !scaleReadingId) {
      Alert.alert('Capture scale first', 'Capture a stable scale reading before confirming')
      return
    }
    setBusy(true)
    const operationId = createOperationId('xrf_test')
    const payload: Record<string, unknown> = {
      xrfTestId: pending.xrfTestId,
      ingestId: pending.ingestId || undefined,
      analyzerId,
      batchNumber: batchNumber.trim() || undefined,
      batchId: batchId.trim() || undefined,
      jobId: jobId.trim() || undefined,
      materialId: materialId.trim() || undefined,
      scaleId: scaleId.trim() || undefined,
      scaleReadingId: scaleReadingId || undefined,
      department: user?.department || 'quality_control',
      operationId,
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'xrf_test', payload, scaleId: scaleId || undefined })
        Alert.alert('Saved offline', 'XRF confirmation queued for sync')
        return
      }
      await submitXrfTest(payload)
      Alert.alert('Confirmed', 'XRF result linked to scale reading')
      setPending(null)
      setElements([])
      setPhase('idle')
      clearCapture()
      await loadPending()
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

  const isSim = pending?.source === 'simulated'

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Quality control — confirm gateway results only</Subtitle>
        <View style={styles.metaRow}>
          <StatusPill label={`ANALYZER ${analyzerId}`} tone="neutral" />
          <StatusPill label={String(status)} tone={status === 'READY' || status === 'CONNECTED' ? 'ok' : 'warn'} />
          {isSim ? <StatusPill label="SIMULATED" tone="warn" /> : null}
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

        <Text style={styles.label}>Linked scale</Text>
        <View style={styles.scaleRow}>
          {scales.map((id) => (
            <BigButton
              key={id}
              label={id === scaleId ? `✓ ${id}` : id}
              tone={id === scaleId ? 'accent' : 'neutral'}
              onPress={() => onSelectScale(id)}
            />
          ))}
        </View>
        {scaleId ? (
          <>
            <WeightDisplay
              weight={live?.weight ?? null}
              unit="g"
              stable={!!live?.stable}
            />
            {scaleReadingId ? (
              <View style={styles.captured}>
                <StatusPill label="READING LOCKED" tone="ok" />
                <Text style={styles.hint}>
                  {capturedWeight != null ? `${capturedWeight.toFixed(2)} g` : '—'} · id {scaleReadingId.slice(-8)}
                </Text>
                <BigButton label="CLEAR CAPTURE" onPress={clearCapture} tone="neutral" disabled={busy} />
              </View>
            ) : (
              <BigButton
                label={busy ? 'CAPTURING…' : 'CAPTURE STABLE'}
                onPress={captureStable}
                disabled={busy || !live?.stable}
              />
            )}
          </>
        ) : (
          <Text style={styles.hint}>No enabled scales in registry</Text>
        )}

        {phase === 'waiting' ? (
          <Text style={styles.testing}>Waiting for analyzer / gateway…</Text>
        ) : null}
        {phase === 'result' && elements.length ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>{isSim ? 'SIMULATED RESULT' : 'HARDWARE RESULT'}</Text>
            {pending?.xrfTestId ? (
              <Text style={styles.hint}>ID: {pending.xrfTestId}</Text>
            ) : null}
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

        <BigButton
          label={busy && phase === 'waiting' ? 'CHECKING…' : 'CHECK PENDING RESULT'}
          onPress={waitForGateway}
          disabled={busy}
        />
        {phase === 'result' && pending?.xrfTestId ? (
          <BigButton
            label={busy ? 'CONFIRMING…' : 'CONFIRM / SAVE METADATA'}
            onPress={saveResult}
            disabled={busy || (!isSim && !scaleReadingId)}
          />
        ) : null}
        {ALLOW_APP_SIM ? (
          <BigButton label="RUN SIMULATOR (DEV)" onPress={runSimulator} tone="neutral" disabled={busy} />
        ) : null}
        <BigButton label="REFRESH STATUS" onPress={refresh} tone="neutral" disabled={busy} />
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
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  captured: { marginVertical: spacing.sm, gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  testing: { color: colors.accent, fontSize: 18, fontWeight: '800', textAlign: 'center', marginVertical: spacing.lg },
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
