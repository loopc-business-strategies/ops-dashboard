import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection } from '@/src/components/async'
import { WeightCapturePanel } from '@/src/components/weightCapture/WeightCapturePanel'
import { QrFirstResolve } from '@/src/components/QrFirstResolve'
import { AuthorizedScalePicker } from '@/src/components/AuthorizedScalePicker'
import { fetchOpenPasses, metalIn } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useWeightCapture } from '@/src/hooks/useWeightCapture'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId, enqueueOutbox } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { useAuth } from '@/src/context/AuthContext'
import { getDeviceId } from '@/src/device/deviceIdentity'
import { captureMethodLabel, weightSourcePayload } from '@/src/scaleCamera/weightCaptureService'
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

const DEFAULT_MATERIALS = [
  { code: 'gold', label: 'Gold', weight: '' },
  { code: 'alloy', label: 'Alloy', weight: '' },
  { code: 'other', label: 'Other', weight: '' },
]

export default function MetalInScreen() {
  const params = useLocalSearchParams<{ passId?: string; scaleId?: string }>()
  const { user } = useAuth()
  const [selected, setSelected] = useState<PassRow | null>(null)
  const [scaleId, setScaleId] = useState(String(params.scaleId || ''))
  const [showList, setShowList] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS)
  const inFlightOpId = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const scales = useAuthorizedScaleIds(user?.department)
  const capture = useWeightCapture(scaleId, scales.profiles[scaleId] || null)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  const materialsTotal = useMemo(() => {
    return materials.reduce((a, m) => a + (Number(m.weight) || 0), 0)
  }, [materials])

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

  const setMaterialWeight = (code: string, weight: string) => {
    setMaterials((prev) => prev.map((m) => (m.code === code ? { ...m, weight } : m)))
  }

  const submit = async () => {
    if (!selected) return
    if (!scaleId) {
      Alert.alert('Select a scale', 'Choose an authorized scale before submitting.')
      return
    }
    const captured = capture.captured
    if (!captured) {
      Alert.alert('Capture weight', 'Capture a stable scale reading or confirm a camera weight before confirming.')
      return
    }
    for (const m of materials) {
      if (m.weight.trim() === '') continue
      const n = Number(m.weight)
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert('Invalid weight', `${m.label} must be a non-negative number`)
        return
      }
    }
    if (materialsTotal > 0 && Math.abs(materialsTotal - captured.weight) > 0.5) {
      Alert.alert(
        'Materials total mismatch',
        `Materials (${materialsTotal.toFixed(2)} g) must match captured weight (${captured.weight.toFixed(2)} g)`,
      )
      return
    }
    if (busy || submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setSubmitError('')
    const operationId = inFlightOpId.current || createOperationId('metal_in')
    inFlightOpId.current = operationId
    const materialsPayload =
      materialsTotal > 0
        ? materials
            .filter((m) => m.weight.trim() !== '')
            .map((m) => ({ code: m.code, label: m.label, weight: Number(m.weight) }))
        : undefined
    const deviceId = await getDeviceId().catch(() => '')
    const payload = {
      passId: selected._id,
      scaleId,
      ...weightSourcePayload(captured),
      receivedWeight: captured.weight,
      operationId,
      ...(deviceId ? { deviceId } : {}),
      ...(materialsPayload ? { materials: materialsPayload } : {}),
    }
    try {
      const net = await NetInfo.fetch()
      // A capture still in the outbox must sync first, so the metal op queues behind it.
      if (!net.isConnected || captured.queued) {
        await enqueueOutbox({
          operationId,
          operationType: 'metal_in',
          payload,
          scaleId,
          deviceId: deviceId || undefined,
        })
        Alert.alert('Saved offline', 'Metal IN queued — will sync when online.')
        inFlightOpId.current = null
        capture.clearCapture()
        setSaved(true)
        if (net.isConnected) flushOutbox().catch(() => undefined)
        return
      }
      await metalIn(payload)
      Alert.alert(
        'METAL IN RECORDED',
        `Batch: ${selected.passNumber || selected._id}\nWeight: ${captured.weight.toFixed(2)} g (${captureMethodLabel(captured.method)})\nOperator: ${user?.name || '—'}`,
      )
      inFlightOpId.current = null
      capture.clearCapture()
      setSaved(true)
      setMaterials(DEFAULT_MATERIALS.map((m) => ({ ...m })))
    } catch (err) {
      await enqueueOutbox({
        operationId,
        operationType: 'metal_in',
        payload,
        scaleId,
        deviceId: deviceId || undefined,
      })
      setSubmitError(err instanceof Error ? err.message : 'Failed — queued offline')
      try {
        await flushOutbox()
        inFlightOpId.current = null
      } catch {
        /* keep same operationId for retry */
      }
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scan → verify → scale → materials → capture weight → confirm</Subtitle>

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

        <Text style={styles.step}>WEIGHT CAPTURE</Text>
        <WeightCapturePanel
          scaleId={scaleId}
          capture={capture}
          busy={busy}
          context={{ department: user?.department, passId: selected?._id, batchNumber: selected?.batchNumber }}
        />

        <Text style={styles.step}>MATERIAL BREAKDOWN (OPTIONAL)</Text>
        {materials.map((m) => (
          <View key={m.code} style={styles.matRow}>
            <Text style={styles.matLabel}>{m.label}</Text>
            <TextInput
              style={styles.matInput}
              keyboardType="decimal-pad"
              value={m.weight}
              onChangeText={(t) => setMaterialWeight(m.code, t)}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.matUnit}>g</Text>
          </View>
        ))}
        <Text style={styles.selected}>TOTAL {materialsTotal.toFixed(2)} g</Text>

        {submitError ? <Text style={styles.err}>{submitError}</Text> : null}
        <BigButton
          label={busy ? 'SAVING…' : saved ? 'SAVED' : 'CONFIRM METAL IN'}
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
  matRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  matLabel: { color: colors.text, fontWeight: '700', width: 72 },
  matInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 18,
  },
  matUnit: { color: colors.textMuted, fontWeight: '700' },
})
