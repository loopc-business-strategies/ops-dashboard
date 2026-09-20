import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import {
  AsyncSection,
  ErrorState,
  HardwareStatus,
  SectionLoading,
} from '@/src/components/async'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { AuthorizedScalePicker } from '@/src/components/AuthorizedScalePicker'
import {
  fetchXrfDevices,
  fetchXrfStatus,
  fetchXrfTests,
  submitXrfTest,
} from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
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

function field(match: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = match[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

export default function XrfScreen() {
  const { user } = useAuth()
  const [analyzerId, setAnalyzerId] = useState<string | null>(null)
  const [analyzerStatus, setAnalyzerStatus] = useState('UNKNOWN')
  const [verified, setVerified] = useState(false)
  const [batchNumber, setBatchNumber] = useState('')
  const [batchId, setBatchId] = useState('')
  const [jobId, setJobId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [scaleId, setScaleId] = useState('')
  const [pending, setPending] = useState<PendingTest | null>(null)
  const [pendingStatus, setPendingStatus] = useState<'idle' | 'loading' | 'empty' | 'ready' | 'error'>('idle')
  const [pendingError, setPendingError] = useState('')
  const [pollRefreshing, setPollRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const pendingRef = useRef<PendingTest | null>(null)
  const capture = useStableScaleCapture(scaleId)
  const scales = useAuthorizedScaleIds(user?.department)

  pendingRef.current = pending

  const devices = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchXrfDevices({ signal })
      return res.devices || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:xrf-devices' },
  )

  const applyVerifiedMatch = (match: Record<string, unknown>) => {
    setBatchId(field(match, 'batchId', '_id', 'id'))
    setBatchNumber(field(match, 'batchNumber', 'passNumber'))
    setJobId(field(match, 'jobId', 'jobNumber', 'job'))
    setMaterialId(field(match, 'materialId', 'material', 'alloy'))
    setVerified(true)
  }

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

  const runSimulator = async () => {
    if (!ALLOW_APP_SIM) {
      Alert.alert('Not available', 'Simulator is disabled in production builds.')
      return
    }
    if (!analyzerId) {
      Alert.alert('Select analyzer', 'Choose an authorized XRF analyzer first')
      return
    }
    if (!verified) {
      Alert.alert('Verify batch first', 'Scan or verify a batch QR before running the simulator.')
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
        scaleReadingId: capture.captured?.scaleReadingId || undefined,
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
    if (!verified) {
      Alert.alert('Verify batch first', 'Scan or verify a batch QR before confirming.')
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
    if (!isSim && !capture.captured?.scaleReadingId) {
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
      scaleReadingId: capture.captured?.scaleReadingId || undefined,
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
      capture.clearCapture()
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
        <Subtitle>Scan → capture stable → select analyzer → confirm gateway result</Subtitle>

        <Text style={styles.section}>1 — VERIFY BATCH (QR PRIMARY)</Text>
        <QrFirstResolve hint="Scan batch / job / material QR for QC" onVerified={applyVerifiedMatch} />
        {verified ? (
          <Text style={styles.selected}>
            Verified: {batchNumber || batchId || '—'}
            {jobId ? ` · job ${jobId}` : ''}
            {materialId ? ` · ${materialId}` : ''}
          </Text>
        ) : (
          <Text style={styles.hint}>Scan or verify a code before capture and confirm.</Text>
        )}

        <Text style={styles.section}>2 — AUTHORIZED SCALE</Text>
        <AuthorizedScalePicker scaleId={scaleId} onSelect={setScaleId} scales={scales} />
        <StableCapturePanel scaleId={scaleId} capture={capture} busy={busy} />

        <Text style={styles.section}>3 — XRF ANALYZER</Text>
        <AsyncSection
          status={devices.status}
          loadingLabel="Loading analyzers…"
          error={devices.error || 'Unable to load analyzers'}
          emptyMessage="No XRF analyzer configured."
          onRetry={devices.reload}
        >
          {!analyzerId ? (
            <Text style={styles.hint}>Select an authorized analyzer — nothing is auto-selected.</Text>
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
            <ErrorState message="XRF analyzer offline." onRetry={refreshAnalyzerStatus} />
          ) : null}
        </AsyncSection>

        <Text style={styles.section}>4 — XRF RESULT</Text>
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
            <Text style={styles.hint}>Elements are display-only — not editable.</Text>
          </View>
        ) : null}

        <BigButton label="CHECK PENDING RESULT" onPress={() => loadPending('manual')} disabled={busy || !analyzerId} />
        {pendingStatus === 'ready' && pending?.xrfTestId ? (
          <BigButton
            label={busy ? 'CONFIRMING…' : 'CONFIRM / SAVE METADATA'}
            onPress={saveResult}
            disabled={busy || !verified || !analyzerId || (!isSim && !capture.hasCapture)}
          />
        ) : null}
        {ALLOW_APP_SIM ? (
          <BigButton label="RUN SIMULATOR (DEV)" onPress={runSimulator} tone="neutral" disabled={busy || !analyzerId || !verified} />
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
  selected: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
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
