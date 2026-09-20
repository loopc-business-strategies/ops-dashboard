import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection } from '@/src/components/async'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { AuthorizedScalePicker } from '@/src/components/AuthorizedScalePicker'
import { fetchOpenPasses, metalIn } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { useAuth } from '@/src/context/AuthContext'
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
  const params = useLocalSearchParams<{ passId?: string; scaleId?: string }>()
  const { user } = useAuth()
  const [selected, setSelected] = useState<PassRow | null>(null)
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [showList, setShowList] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlightOpId = useRef<string | null>(null)
  const capture = useStableScaleCapture(scaleId)
  const scales = useAuthorizedScaleIds(user?.department)

  const passes = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchOpenPasses(undefined, { signal })
      return (res.passes || []) as PassRow[]
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:open-passes' },
  )

  useEffect(() => {
    if (params.scaleId) setScaleId(String(params.scaleId))
  }, [params.scaleId])

  useEffect(() => {
    if (!params.passId || !passes.data) return
    const pre = passes.data.find((x) => x._id === params.passId)
    if (pre) setSelected(pre)
  }, [params.passId, passes.data])

  const submit = async () => {
    if (!selected) return
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
    const operationId = inFlightOpId.current || createOperationId('metal_in')
    inFlightOpId.current = operationId
    const payload = {
      passId: selected._id,
      scaleId,
      stableReadingId: capture.captured.scaleReadingId,
      receivedWeight: capture.captured.weight,
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
        inFlightOpId.current = null
        return
      }
      await metalIn(payload)
      Alert.alert('Success', 'Metal IN recorded')
      inFlightOpId.current = null
      capture.clearCapture()
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
        inFlightOpId.current = null
      } catch {
        /* keep same operationId for retry */
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scan → verify → scale → capture stable → confirm</Subtitle>

        <QrFirstResolve
          hint="Scan inbound pass / batch QR"
          onVerified={(match) => {
            const id = String(match.passId || match._id || match.id || '')
            if (id) {
              const fromList = (passes.data || []).find((p) => p._id === id)
              setSelected(
                fromList || {
                  _id: id,
                  passNumber: String(match.passNumber || match.batchNumber || id),
                  batchNumber: String(match.batchNumber || ''),
                  fromDepartment: String(match.fromDepartment || ''),
                  toDepartment: String(match.toDepartment || ''),
                  status: String(match.status || ''),
                },
              )
            }
          }}
        />

        {selected ? (
          <Text style={styles.selected}>
            Selected: {selected.passNumber || selected._id}
            {selected.fromDepartment ? ` · ${selected.fromDepartment} → ${selected.toDepartment || ''}` : ''}
          </Text>
        ) : null}

        <BigButton
          label={showList ? 'HIDE OPEN PASSES' : 'SELECT FROM OPEN PASSES (SECONDARY)'}
          tone="neutral"
          onPress={() => setShowList((v) => !v)}
        />
        {showList ? (
          <AsyncSection
            status={passes.status}
            loadingLabel="Loading passes…"
            error={passes.error || 'Unable to load open passes'}
            emptyMessage="No open inbound passes"
            onRetry={passes.reload}
            updatedAt={passes.updatedAt}
            fromCache={passes.fromCache}
            stale={passes.stale}
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
        ) : null}

        <Text style={styles.step}>AUTHORIZED SCALE</Text>
        <AuthorizedScalePicker scaleId={scaleId} onSelect={setScaleId} scales={scales} />

        <Text style={styles.step}>STABLE CAPTURE</Text>
        <StableCapturePanel scaleId={scaleId} capture={capture} busy={busy} />

        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SUBMITTING…' : 'CONFIRM METAL IN'}
          onPress={submit}
          disabled={busy || !selected || !scaleId || !capture.hasCapture}
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
  selected: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  err: { color: colors.danger, marginVertical: spacing.sm },
})
