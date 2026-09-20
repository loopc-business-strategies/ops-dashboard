import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { BigButton, LoadingBlock, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { fetchOpenPasses, fetchScales, metalIn } from '@/src/api/floor'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { colors, spacing } from '@/src/theme'
import NetInfo from '@react-native-community/netinfo'

type PassRow = {
  _id: string
  passNumber?: string
  batchNumber?: string
  weight?: number
  fromDepartment?: string
  toDepartment?: string
  status?: string
}

export default function MetalInScreen() {
  const params = useLocalSearchParams<{ passId?: string }>()
  const [passes, setPasses] = useState<PassRow[]>([])
  const [selected, setSelected] = useState<PassRow | null>(null)
  const [scaleId, setScaleId] = useState('MG-SCALE-001')
  const [scales, setScales] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const live = useLiveScale(scaleId)

  useEffect(() => {
    ;(async () => {
      try {
        const [p, s] = await Promise.all([fetchOpenPasses(), fetchScales()])
        const list = (p.passes || []) as PassRow[]
        setPasses(list)
        const ids = (s.scales || []).map((x) => String(x.scaleId))
        setScales(ids)
        if (ids[0]) setScaleId(ids[0])
        if (params.passId) {
          const pre = list.find((x) => x._id === params.passId)
          if (pre) setSelected(pre)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.passId])

  const submit = async () => {
    if (!selected) return
    if (!live?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Place material on the scale and wait until STABLE.')
      return
    }
    setBusy(true)
    setError('')
    const operationId = createOperationId('metal_in')
    const payload = {
      passId: selected._id,
      scaleId,
      receivedWeight: live.weight,
      operationId,
    }
    try {
      const net = await NetInfo.fetch()
      if (!net.isConnected) {
        await enqueueOutbox({
          operationId,
          operationType: 'metal_in',
          payload,
          scaleId,
        })
        Alert.alert('Saved offline', 'Metal IN queued — will sync when online.')
        return
      }
      await metalIn(payload)
      Alert.alert('Success', 'Metal IN recorded')
    } catch (err) {
      await enqueueOutbox({
        operationId,
        operationType: 'metal_in',
        payload,
        scaleId,
      })
      setError(err instanceof Error ? err.message : 'Failed — queued offline')
      try {
        await flushOutbox()
      } catch {
        /* keep queued */
      }
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
        <Subtitle>Scan/select inbound pass → confirm scale → capture stable weight</Subtitle>
        <Text style={styles.label}>Scale</Text>
        <View style={styles.scaleRow}>
          {scales.map((id) => (
            <BigButton
              key={id}
              label={id === scaleId ? `✓ ${id}` : id}
              tone={id === scaleId ? 'accent' : 'neutral'}
              onPress={() => setScaleId(id)}
            />
          ))}
        </View>
        {!scales.length ? (
          <TextInput
            style={styles.input}
            value={scaleId}
            onChangeText={setScaleId}
            autoCapitalize="characters"
            placeholderTextColor={colors.textMuted}
          />
        ) : null}

        <WeightDisplay weight={live?.weight ?? null} stable={live?.stable ?? null} />

        <Text style={styles.label}>Open passes</Text>
        {passes.length === 0 ? <Text style={styles.hint}>No open inbound passes</Text> : null}
        {passes.map((p) => (
          <BigButton
            key={p._id}
            label={`${selected?._id === p._id ? '✓ ' : ''}${p.passNumber || p._id} · ${p.weight ?? '?'}g · ${p.fromDepartment}→${p.toDepartment}`}
            tone={selected?._id === p._id ? 'accent' : 'neutral'}
            onPress={() => setSelected(p)}
          />
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CAPTURE & SUBMIT METAL IN'}
          onPress={submit}
          disabled={busy || !selected || !live?.stable}
        />
        <Text style={styles.hint}>Operators cannot type weight. Supervisor correction is separate.</Text>
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
  scaleRow: { gap: 0 },
  hint: { color: colors.textMuted, marginTop: 8 },
  error: { color: colors.danger, marginVertical: 8, fontWeight: '600' },
})
