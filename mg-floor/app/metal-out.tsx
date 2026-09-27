import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection } from '@/src/components/async'
import { WeightCapturePanel } from '@/src/components/weightCapture/WeightCapturePanel'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { AuthorizedScalePicker } from '@/src/components/AuthorizedScalePicker'
import { fetchJobs, metalOut } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useWeightCapture } from '@/src/hooks/useWeightCapture'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { useAuth } from '@/src/context/AuthContext'
import { getDeviceId } from '@/src/device/deviceIdentity'
import { weightSourcePayload } from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'

type Job = {
  _id?: string
  batchId?: string
  batchNumber?: string
  currentDepartment?: string
  status?: string
}

export default function MetalOutScreen() {
  const params = useLocalSearchParams<{ batchId?: string; batchNumber?: string; scaleId?: string }>()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Job | null>(null)
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [showList, setShowList] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const scales = useAuthorizedScaleIds(user?.department)
  const capture = useWeightCapture(scaleId, scales.profiles[scaleId] || null)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      return (Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? (raw as { tasks: unknown[] }).tasks
          : []) as Job[]
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:jobs' },
  )

  useEffect(() => {
    if (params.scaleId) setScaleId(String(params.scaleId))
  }, [params.scaleId])

  useEffect(() => {
    if (!params.batchId) return
    const list = jobs.data || []
    const pre = list.find((x) => x._id === params.batchId || x.batchId === params.batchId)
    if (pre) setSelected(pre)
    else setSelected({ _id: params.batchId, batchId: params.batchId, batchNumber: params.batchNumber })
  }, [params.batchId, params.batchNumber, jobs.data])

  const batchId = selected?._id || selected?.batchId

  const submit = async () => {
    if (!batchId || !toDepartment.trim()) {
      Alert.alert('Missing data', 'Select a job and destination department')
      return
    }
    if (!scaleId) {
      Alert.alert('Select a scale', 'Choose an authorized scale before submitting.')
      return
    }
    const captured = capture.captured
    if (!captured) {
      Alert.alert('Capture weight', 'Capture a stable scale reading or confirm a camera weight before confirming.')
      return
    }
    if (busy || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setSubmitError('')
    const operationId = inFlightOpId.current || createOperationId('metal_out')
    inFlightOpId.current = operationId
    const deviceId = await getDeviceId().catch(() => '')
    const payload = {
      batchId,
      toDepartment: toDepartment.trim(),
      fromDepartment: selected?.currentDepartment,
      scaleId,
      ...weightSourcePayload(captured),
      weight: captured.weight,
      operationId,
      ...(deviceId ? { deviceId } : {}),
      purpose: 'MG Floor Metal OUT',
    }
    const queued = { operationId, operationType: 'metal_out' as const, payload, scaleId, deviceId: deviceId || undefined }
    try {
      const net = await NetInfo.fetch()
      // A capture still in the outbox must sync first, so the metal op queues behind it.
      if (!net.isConnected || captured.queued) {
        await enqueueOutbox(queued)
        Alert.alert('Saved offline', 'Metal OUT queued')
        inFlightOpId.current = null
        capture.clearCapture()
        setSaved(true)
        if (net.isConnected) flushOutbox().catch(() => undefined)
        return
      }
      await metalOut(payload)
      Alert.alert('Success', 'Metal OUT recorded')
      inFlightOpId.current = null
      capture.clearCapture()
      setSaved(true)
    } catch (err) {
      await enqueueOutbox(queued)
      setSubmitError(err instanceof Error ? err.message : 'Failed — queued offline')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scan → verify → destination → capture weight → confirm</Subtitle>

        <QrFirstResolve
          hint="Scan job / batch QR"
          onVerified={(match) => {
            const id = String(match.batchId || match._id || match.id || '')
            if (id) {
              setSelected({
                _id: id,
                batchId: id,
                batchNumber: String(match.batchNumber || ''),
                currentDepartment: String(match.currentDepartment || match.department || ''),
                status: String(match.status || ''),
              })
            }
          }}
        />

        {selected ? (
          <Text style={styles.selected}>
            Selected: {selected.batchNumber || selected._id || selected.batchId}
          </Text>
        ) : null}

        <BigButton
          label={showList ? 'HIDE JOB LIST' : 'SELECT FROM JOBS (SECONDARY)'}
          tone="neutral"
          onPress={() => setShowList((v) => !v)}
        />
        {showList ? (
          <AsyncSection
            status={jobs.status}
            loadingLabel="Loading jobs…"
            error={jobs.error || 'Unable to load jobs'}
            emptyMessage="No jobs assigned"
            onRetry={jobs.reload}
            updatedAt={jobs.updatedAt}
            fromCache={jobs.fromCache}
            stale={jobs.stale}
          >
            {(jobs.data || []).map((j) => {
              const id = String(j._id || j.batchId || '')
              const selectedId = String(selected?._id || selected?.batchId || '')
              return (
                <BigButton
                  key={id}
                  label={selectedId === id ? `✓ ${j.batchNumber || id}` : String(j.batchNumber || id)}
                  tone={selectedId === id ? 'accent' : 'neutral'}
                  onPress={() => setSelected(j)}
                />
              )
            })}
          </AsyncSection>
        ) : null}

        <Text style={styles.step}>AUTHORIZED SCALE</Text>
        <AuthorizedScalePicker scaleId={scaleId} onSelect={setScaleId} scales={scales} />

        <Text style={styles.step}>WEIGHT CAPTURE</Text>
        <WeightCapturePanel
          scaleId={scaleId}
          capture={capture}
          busy={busy}
          context={{ department: user?.department, batchId, batchNumber: selected?.batchNumber }}
        />

        <Text style={styles.label}>Destination department</Text>
        <TextInput
          style={styles.input}
          value={toDepartment}
          onChangeText={setToDepartment}
          placeholderTextColor={colors.textMuted}
        />
        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SAVING…' : saved ? 'SAVED' : 'CONFIRM METAL OUT'}
          onPress={submit}
          disabled={busy || !scaleId || !capture.hasCapture}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  step: {
    color: colors.accent,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  selected: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
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
  err: { color: colors.danger, marginVertical: spacing.sm },
})
