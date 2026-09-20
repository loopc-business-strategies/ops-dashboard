import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, StatusPill, Subtitle, WeightDisplay } from '@/src/components/ui'
import {
  AsyncSection,
  ErrorState,
  HardwareStatus,
  SectionLoading,
} from '@/src/components/async'
import {
  captureStableReading,
  fetchScales,
  fetchXrfDevices,
  fetchXrfStatus,
  fetchXrfTests,
  submitXrfTest,
} from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
import { APP_ENV, IS_PRODUCTION } from '@/src/config/env'
import { colors, spacing } from '@/src/theme'
import { userFacingMessage } from '@/src/api/errors'

type ElementRow = { symbol: string; value: number; unit?: string }

type PendingTest = {
  xrfTestId: string
  ingestId?: string | null
  source?: string
  elements?: ElementRow[]
  analyzerId?: string
  testedAt?: string
}

const ALLOW_APP_SIM = !IS_PRODUCTION && APP_ENV !== 'production'

export default function XrfScreen() {
  const { user } = useAuth()
  const [analyzerId, setAnalyzerId] = useState<string | null>(null)
  const [analyzerStatus, setAnalyzerStatus] = useState('UNKNOWN')
  const [batchNumber, setBatchNumber] = useState('')
  const [batchId, setBatchId] = useState('')
  const [jobId, setJobId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [scaleId, setScaleId] = useState('')
  const [scaleReadingId, setScaleReadingId] = useState<string | null>(null)
  const [capturedWeight, setCapturedWeight] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingTest | null>(null)
  const [pendingStatus, setPendingStatus] = useState<'idle' | 'loading' | 'empty' | 'ready' | 'error'>('idle')
  const [pendingError, setPendingError] = useState('')
  const [pollRefreshing, setPollRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const pendingRef = useRef<PendingTest | null>(null)
  const live = useLiveScale(scaleId || null)

  pendingRef.current = pending

  const devices = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchXrfDevices({ signal })
      return res.devices || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:xrf-devices' },
  )

  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchScales({ limit: 50, skip: 0 }, { signal })
      return (res.scales || []).map((x) => String(x.scaleId))
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:scale-ids' },
  )

  const refreshAnalyzerStatus = useCallback(async () => {
    if (!analyzerId) {
      setAnalyzerStatus('UNKNOWN')
      return
    }
    try {
      const st = await fetchXrfStatus(analyzerId)
      setAnalyzerStatus(String(st.status || 'UNKNOWN'))
    } catch {
      setAnalyzerStatus('DISCONNECTED')
    }
  }, [analyzerId])

  const loadPending = useCallback(async (mode: 'initial' | 'poll' | 'manual' = 'initial') => {
    if (!analyzerId) {
      if (mode !== 'poll') {
        setPending(null)
        setPendingStatus('empty')
      }
      return null
    }
    if (mode === 'initial') {
      setPendingStatus('loading')
      setPendingError('')
    } else if (mode === 'manual') {
      setPendingError('')
      if (!pendingRef.current) setPendingStatus('loading')
    } else {
      setPollRefreshing(true)
    }
    pollAbortRef.current?.abort()
    const controller = new AbortController()
    pollAbortRef.current = controller
    try {
      const res = await fetchXrfTests(
        {
          pendingForConfirm: '1',
          analyzerId,
          limit: 5,
        },
        { signal: controller.signal },
      )
      if (controller.signal.aborted || !mountedRef.current) return null
      const tests = (res.tests || []) as PendingTest[]
      const latest = tests[0] || null
      setPending(latest)
      setPendingStatus(latest ? 'ready' : 'empty')
      return latest
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return null
      if (mode === 'poll') {
        return null
      }
      setPendingStatus('error')
      setPendingError(userFacingMessage(err) || 'Unable to load pending XRF')
      return null
    } finally {
      if (mountedRef.current) setPollRefreshing(false)
    }
  }, [analyzerId])

  useEffect(() => {
    mountedRef.current = true
    refreshAnalyzerStatus()
    loadPending('initial')
    return () => {
      mountedRef.current = false
      pollAbortRef.current?.abort()
    }
  }, [refreshAnalyzerStatus, loadPending])

  useEffect(() => {
    let cancelled = false
    const schedule = () => {
      if (cancelled) return
      pollTimerRef.current = setTimeout(async () => {
        if (cancelled) return
        await loadPending('poll')
        if (!cancelled) schedule()
      }, 5000)
    }
    schedule()
    return () => {
      cancelled = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
      pollAbortRef.current?.abort()
    }
  }, [loadPending])

  const clearCapture = () => {
    setScaleReadingId(null)
    setCapturedWeight(null)
  }

  const captureStable = async () => {
    if (!scaleId) {
      Alert.alert('Select scale', 'Pick a linked scale first')
      return
    }
    if (!live.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Place material on the scale and wait until STABLE.')
      return
    }
    setBusy(true)
    try {
      const res = await captureStableReading(scaleId, live.weight)
      setScaleReadingId(String(res.scaleReadingId))
      setCapturedWeight(Number(res.weight))
      Alert.alert('Captured', `Stable reading locked · ${Number(res.weight).toFixed(2)} g`)
    } catch (err) {
      Alert.alert('Capture failed', userFacingMessage(err) || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const runSimulator = async () => {
    if (!ALLOW_APP_SIM) {
      Alert.alert('Not available', 'Simulator is disabled in production builds.')
      return
    }
    if (!analyzerId) {
      Alert.alert('Select analyzer', 'Choose an authorized XRF analyzer first')
      return
    }
    setBusy(true)
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
      setPending({
        xrfTestId: String(test.xrfTestId || ''),
        source: 'simulated',
        elements: simElements,
        analyzerId: analyzerId || undefined,
      })
      setPendingStatus('ready')
      Alert.alert('SIMULATED', 'Dev simulator result saved (tagged source=simulated)')
    } catch (err) {
      Alert.alert('Simulator failed', userFacingMessage(err) || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const saveResult = async () => {
    if (!analyzerId) {
      Alert.alert('Select analyzer', 'Choose an authorized XRF analyzer first')
      return
    }
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
      setPendingStatus('empty')
      clearCapture()
      await loadPending('manual')
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'xrf_test', payload, scaleId: scaleId || undefined })
      Alert.alert('Queued', userFacingMessage(err) || 'Saved offline after failure')
    } finally {
      setBusy(false)
    }
  }

  const isSim = pending?.source === 'simulated'
  const elements = Array.isArray(pending?.elements) ? pending!.elements! : []

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Quality control — confirm gateway results only</Subtitle>

        <Text style={styles.section}>XRF ANALYZER</Text>
        <AsyncSection
          status={devices.status}
          loadingLabel="Loading analyzers…"
          error={devices.error || 'Unable to load analyzers'}
          emptyMessage="No analyzers registered"
          onRetry={devices.reload}
        >
          {!analyzerId ? (
            <Text style={styles.hint}>Select an authorized analyzer before QC.</Text>
          ) : null}
          {(devices.data || []).map((d) => {
            const id = String(d.analyzerId || '')
            return (
              <BigButton
                key={id}
                label={analyzerId === id ? `✓ ${id}` : id}
                tone={analyzerId === id ? 'accent' : 'neutral'}
                onPress={() => {
                  setAnalyzerId(id)
                  setPending(null)
                  setPendingStatus('idle')
                }}
              />
            )
          })}
          {analyzerId ? <HardwareStatus label={analyzerId} status={analyzerStatus} /> : null}
          {analyzerId && (analyzerStatus === 'DISCONNECTED' || analyzerStatus === 'ERROR') ? (
            <ErrorState message="XRF Analyzer DISCONNECTED" onRetry={refreshAnalyzerStatus} />
          ) : null}
        </AsyncSection>

        <Text style={styles.label}>Batch / job / material</Text>
        <TextInput style={styles.input} value={batchNumber} onChangeText={setBatchNumber} placeholderTextColor={colors.textMuted} placeholder="Batch number" />
        <TextInput style={styles.input} value={batchId} onChangeText={setBatchId} placeholderTextColor={colors.textMuted} placeholder="Batch ID" />
        <TextInput style={styles.input} value={jobId} onChangeText={setJobId} placeholder="Job ID" placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} value={materialId} onChangeText={setMaterialId} placeholder="Material ID" placeholderTextColor={colors.textMuted} />

        <Text style={styles.section}>SCALE</Text>
        {scales.status === 'loading' && !scales.data ? <SectionLoading label="Loading scales…" /> : null}
        {scales.status === 'error' && !scales.data ? (
          <ErrorState message={scales.error || 'Unable to load scales'} onRetry={scales.reload} />
        ) : null}
        <View style={styles.scaleRow}>
          {(scales.data || []).map((id) => (
            <BigButton
              key={id}
              label={id === scaleId ? `✓ ${id}` : id}
              tone={id === scaleId ? 'accent' : 'neutral'}
              onPress={() => {
                setScaleId(id)
                clearCapture()
              }}
            />
          ))}
        </View>
        {scaleId ? (
          <>
            <WeightDisplay
              weight={live.weight}
              unit="g"
              stable={live.stable}
              connectionStatus={live.connectionStatus}
              lastReadingAt={live.lastReadingAt}
              onReconnect={live.reconnect}
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
                disabled={busy || !live.stable}
              />
            )}
          </>
        ) : null}

        <Text style={styles.section}>XRF RESULT</Text>
        {pendingStatus === 'loading' ? <SectionLoading label="Checking pending…" /> : null}
        {pendingStatus === 'empty' ? (
          <View style={styles.waitingRow}>
            <Text style={styles.hint}>WAITING FOR XRF RESULT</Text>
            {pollRefreshing ? <Text style={styles.pollHint}>↻ Checking…</Text> : null}
          </View>
        ) : null}
        {pendingStatus === 'error' ? (
          <ErrorState message={pendingError || 'Unable to load pending'} onRetry={() => loadPending('manual')} />
        ) : null}
        {pendingStatus === 'ready' && pending ? (
          <View style={styles.result}>
            {pollRefreshing ? <Text style={styles.pollHint}>↻ Checking…</Text> : null}
            <Text style={styles.resultTitle}>{isSim ? 'SIMULATED RESULT' : 'HARDWARE RESULT'}</Text>
            {isSim ? <StatusPill label="SIMULATED" tone="warn" /> : null}
            <Text style={styles.hint}>ID: {pending.xrfTestId}</Text>
            {elements.map((e) => (
              <Text key={e.symbol} style={styles.el}>
                {e.symbol}  {e.value}
                {e.unit || '%'}
              </Text>
            ))}
            <Text style={styles.hint}>Operator: {user?.name || '—'} · {new Date().toLocaleString()}</Text>
          </View>
        ) : null}

        <BigButton label="CHECK PENDING RESULT" onPress={() => loadPending('manual')} disabled={busy} />
        {pendingStatus === 'ready' && pending?.xrfTestId ? (
          <BigButton
            label={busy ? 'CONFIRMING…' : 'CONFIRM / SAVE METADATA'}
            onPress={saveResult}
            disabled={busy || (!isSim && !scaleReadingId)}
          />
        ) : null}
        {ALLOW_APP_SIM ? (
          <BigButton label="RUN SIMULATOR (DEV)" onPress={runSimulator} tone="neutral" disabled={busy} />
        ) : null}
        <BigButton
          label="REFRESH STATUS"
          onPress={() => {
            devices.reload()
            scales.reload()
            refreshAnalyzerStatus()
            loadPending('manual')
          }}
          tone="neutral"
          disabled={busy}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    color: colors.accent,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
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
  waitingRow: { marginBottom: spacing.sm },
  pollHint: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 4 },
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
})
