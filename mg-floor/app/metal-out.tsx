import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import { fetchJobs, fetchScales, metalOut } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
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
  const [selected, setSelected] = useState<Job | null>(null)
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const live = useLiveScale(scaleId || null)

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
    useCallback(async (signal) => {
      const res = await fetchScales({ limit: 50, skip: 0 }, { signal })
      return (res.scales || []).map((x) => String(x.scaleId))
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:scale-ids' },
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
    if (!live.lastReading?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Wait until the scale shows STABLE.')
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
      weight: live.weight,
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
        <Subtitle>Select job → destination → stable scale capture</Subtitle>

        <Text style={styles.step}>Jobs</Text>
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

        <Text style={styles.step}>Select scale</Text>
        {!scaleId ? <Text style={styles.hint}>Select a scale to start live weighing.</Text> : null}
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

        <WeightDisplay
          weight={live.weight}
          stable={live.stable}
          connectionStatus={live.connectionStatus}
          lastReadingAt={live.lastReadingAt}
          onReconnect={live.reconnect}
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
          label={busy ? 'SUBMITTING…' : 'CONFIRM METAL OUT'}
          onPress={submit}
          disabled={busy || !scaleId || !live.stable}
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
  err: { color: colors.danger, marginVertical: spacing.sm },
})
