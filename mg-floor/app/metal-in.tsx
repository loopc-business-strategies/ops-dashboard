import React, { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle, WeightDisplay } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import { fetchOpenPasses, fetchScales, metalIn } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useLiveScale } from '@/src/hooks/useLiveScale'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { colors, spacing } from '@/src/theme'

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
  const [selected, setSelected] = useState<PassRow | null>(null)
  const [scaleId, setScaleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const live = useLiveScale(scaleId || null)

  const passes = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchOpenPasses(undefined, { signal })
      return (res.passes || []) as PassRow[]
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:open-passes' },
  )

  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchScales({ limit: 100 }, { signal })
      return (res.scales || []).map((x) => String(x.scaleId))
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:scale-ids' },
  )

  useEffect(() => {
    if (scales.data?.[0] && !scaleId) setScaleId(scales.data[0])
  }, [scales.data, scaleId])

  useEffect(() => {
    if (!params.passId || !passes.data) return
    const pre = passes.data.find((x) => x._id === params.passId)
    if (pre) setSelected(pre)
  }, [params.passId, passes.data])

  const submit = async () => {
    if (!selected) return
    if (!live.lastReading?.stable || live.weight == null) {
      Alert.alert('Waiting for stable weight', 'Place material on the scale and wait until STABLE.')
      return
    }
    setBusy(true)
    setSubmitError('')
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
      setSubmitError(err instanceof Error ? err.message : 'Failed — queued offline')
      try {
        await flushOutbox()
      } catch {
        /* keep queued */
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scan/select inbound pass → confirm scale → capture stable weight</Subtitle>

        <Text style={styles.step}>Step 1 — Open passes</Text>
        <AsyncSection
          status={passes.status}
          loadingLabel="Loading passes…"
          error={passes.error || 'Unable to load open passes'}
          emptyMessage="No open inbound passes"
          onRetry={passes.reload}
          updatedAt={passes.updatedAt}
          fromCache={passes.fromCache}
        >
          {(passes.data || []).map((p) => (
            <BigButton
              key={p._id}
              label={
                selected?._id === p._id
                  ? `✓ ${p.passNumber || p._id}`
                  : String(p.passNumber || p.batchNumber || p._id)
              }
              tone={selected?._id === p._id ? 'accent' : 'neutral'}
              onPress={() => setSelected(p)}
            />
          ))}
        </AsyncSection>

        <Text style={styles.step}>Step 2 — Scale</Text>
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
              onPress={() => setScaleId(id)}
            />
          ))}
        </View>

        <Text style={styles.step}>Step 3 — Live weight</Text>
        <WeightDisplay
          weight={live.weight}
          stable={live.stable}
          connectionStatus={live.connectionStatus}
          lastReadingAt={live.lastReadingAt}
          onReconnect={live.reconnect}
        />

        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CONFIRM METAL IN'}
          onPress={submit}
          disabled={busy || !selected || !live.stable}
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
    letterSpacing: 0.5,
  },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  err: { color: colors.danger, marginVertical: spacing.sm },
})
