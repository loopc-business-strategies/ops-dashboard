import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
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
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<Job | null>(null)
  const [toDepartment, setToDepartment] = useState('')
  const [scaleId, setScaleId] = useState('MG-SCALE-001')
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
        if (ids[0]) setScaleId(ids[0])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
        <TextInput style={styles.input} value={scaleId} onChangeText={setScaleId} autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
        <WeightDisplay weight={live?.weight ?? null} stable={live?.stable ?? null} />
        <Text style={styles.label}>Destination department</Text>
        <TextInput
          style={styles.input}
          value={toDepartment}
          onChangeText={setToDepartment}
          placeholder="e.g. casting"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Jobs</Text>
        {jobs.length === 0 ? <Text style={styles.hint}>No assigned jobs — open a batch from Scan</Text> : null}
        {jobs.map((j, idx) => {
          const id = String(j._id || j.batchId || idx)
          return (
            <BigButton
              key={id}
              label={`${selected && (selected._id || selected.batchId) === (j._id || j.batchId) ? '✓ ' : ''}${j.batchNumber || id} · ${j.currentDepartment || ''} · ${j.status || ''}`}
              tone="neutral"
              onPress={() => setSelected(j)}
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
  hint: { color: colors.textMuted, marginTop: 8 },
  error: { color: colors.danger, marginVertical: 8, fontWeight: '600' },
})
