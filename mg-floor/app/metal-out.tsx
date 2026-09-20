import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, LoadingBlock, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { fetchJobs, fetchScales, metalOut } from '@/src/api/floor'
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
  const params = useLocalSearchParams<{ batchId?: string; batchNumber?: string }>()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<Job | null>(null)
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState('MG-SCALE-001')
  const [scaleOptions, setScaleOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const live = useLiveScale(scaleId)

  useEffect(() => {
    ;(async () => {
      try {
        const [j, s] = await Promise.all([fetchJobs(), fetchScales()])
        const list = (j.jobs || []) as Job[]
        setJobs(list)
        const ids = (s.scales || []).map((x) => String(x.scaleId))
        setScaleOptions(ids)
        if (ids[0]) setScaleId(ids[0])
        if (params.batchId) {
          const pre = list.find((x) => x._id === params.batchId || x.batchId === params.batchId)
          if (pre) setSelected(pre)
          else setSelected({ _id: params.batchId, batchId: params.batchId, batchNumber: params.batchNumber })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.batchId, params.batchNumber])

  const batchId = selected?._id || selected?.batchId

  const submit = async () => {
    if (!batchId || !toDepartment.trim()) {
      Alert.alert('Missing data', 'Select a job and destination department')
      return
    }
    if (!live?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Wait until the scale shows STABLE.')
      return
    }
    setBusy(true)
    setError('')
    const operationId = createOperationId('metal_out')
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
        return
      }
      await metalOut(payload)
      Alert.alert('Success', 'Metal OUT recorded')
    } catch (err) {
      await enqueueOutbox({ operationId, operationType: 'metal_out', payload, scaleId })
      setError(err instanceof Error ? err.message : 'Failed — queued offline')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView>
        <Subtitle>Select job → destination → stable scale capture</Subtitle>
        <Text style={styles.label}>Scale</Text>
        {scaleOptions.map((id) => (
          <BigButton
            key={id}
            label={id === scaleId ? `✓ ${id}` : id}
            tone={id === scaleId ? 'accent' : 'neutral'}
            onPress={() => setScaleId(id)}
          />
        ))}
        {!scaleOptions.length ? (
          <TextInput style={styles.input} value={scaleId} onChangeText={setScaleId} autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
        ) : null}
        <WeightDisplay weight={live?.weight ?? null} stable={live?.stable ?? null} />
        <Text style={styles.label}>Destination department</Text>
        <TextInput
          style={styles.input}
          value={toDepartment}
          onChangeText={setToDepartment}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Jobs</Text>
        {jobs.map((job, idx) => {
          const id = String(job._id || job.batchId || idx)
          const active = (selected?._id || selected?.batchId) === (job._id || job.batchId)
          return (
            <BigButton
              key={id}
              label={`${active ? '✓ ' : ''}${job.batchNumber || id} · ${job.currentDepartment || '—'}`}
              tone={active ? 'accent' : 'neutral'}
              onPress={() => setSelected(job)}
            />
          )
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <BigButton label={busy ? 'SUBMITTING…' : 'CAPTURE & SUBMIT METAL OUT'} onPress={submit} disabled={busy || !live?.stable} />
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
  error: { color: colors.danger, marginVertical: 8, fontWeight: '600' },
})
