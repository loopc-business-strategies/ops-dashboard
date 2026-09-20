import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { fetchJobs, fetchScales, metalOut } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { useAuth } from '@/src/context/AuthContext'
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
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const capture = useStableScaleCapture(scaleId)

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

  const scales = useAsyncResource(
    useCallback(
      async (signal) => {
        const res = await fetchScales(
          {
            limit: 50,
            skip: 0,
            ...(user?.department ? { department: String(user.department) } : {}),
          },
          { signal },
        )
        return (res.scales || []).map((x) => String(x.scaleId))
      },
      [user?.department],
    ),
    { isEmpty: (d) => !d.length, cacheKey: `mg-floor:scale-ids:${user?.department || 'all'}` },
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
    if (!capture.captured?.scaleReadingId) {
      Alert.alert('Capture stable weight', 'Capture a stable scale reading before confirming.')
      return
    }
    if (busy) return
    setBusy(true)
    setSubmitError('')
    const operationId = inFlightOpId.current || createOperationId('metal_out')
    inFlightOpId.current = operationId
    const payload = {
      batchId,
      toDepartment: toDepartment.trim(),
      fromDepartment: selected?.currentDepartment,
      scaleId,
      stableReadingId: capture.captured.scaleReadingId,
      weight: capture.captured.weight,
      operationId,
      purpose: 'MG Floor Metal OUT',
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({ operationId, operationType: 'metal_out', payload, scaleId })
        Alert.alert('Saved offline', 'Metal OUT queued')
        inFlightOpId.current = null
        return
      }
      await metalOut(payload)
      Alert.alert('Success', 'Metal OUT recorded')
      inFlightOpId.current = null
      capture.clearCapture()
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'metal_out', payload, scaleId })
      setSubmitError(err instanceof Error ? err.message : 'Failed — queued offline')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scan → verify → destination → capture stable → confirm</Subtitle>

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
        {scales.status === 'loading' && !scales.data ? <SectionLoading label="Loading scales…" /> : null}
        {scales.status === 'error' && !scales.data ? (
          <ErrorState message={scales.error || 'Unable to load scales'} onRetry={scales.reload} />
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

        <Text style={styles.label}>Destination department</Text>
        <TextInput
          style={styles.input}
          value={toDepartment}
          onChangeText={setToDepartment}
          placeholderTextColor={colors.textMuted}
        />
        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CONFIRM METAL OUT'}
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
