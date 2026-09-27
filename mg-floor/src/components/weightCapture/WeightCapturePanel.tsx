import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { StableCapturePanel } from '@/src/components/StableCapturePanel'
import { BigButton, StatusPill } from '@/src/components/ui'
import { userFacingMessage } from '@/src/api/errors'
import type { WeightCaptureApi } from '@/src/hooks/useWeightCapture'
import { createOperationId } from '@/src/offline/outbox'
import { formatWeight } from '@/src/scaleCamera/cameraSettings'
import {
  captureMethodLabel,
  recordWeightCapture,
  type CaptureContext,
} from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'
import { ManualWeightEntry } from './ManualWeightEntry'
import { ScaleCameraCapture, type ConfirmedCameraReading } from './ScaleCameraCapture'
import { WeightCaptureMethodSelector } from './WeightCaptureMethodSelector'

/**
 * Weight capture for Metal IN/OUT: DIGITAL SCALE (unchanged stable capture), SCALE CAMERA (OCR)
 * or permission-gated MANUAL. Camera/manual readings are saved as a capture record on confirm.
 */
export function WeightCapturePanel({
  scaleId,
  capture,
  busy,
  context,
}: {
  scaleId: string
  capture: WeightCaptureApi
  busy?: boolean
  context?: CaptureContext
}) {
  const { method, methods, setMethod, captured, clearCapture, setRecorded, profile, digital } = capture
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savingRef = useRef(false)
  /** Reused if a save attempt fails so the retry stays idempotent server-side. */
  const pendingCaptureId = useRef<string | null>(null)

  useEffect(() => {
    pendingCaptureId.current = null
    setJustSaved(false)
  }, [scaleId, method])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 2500)
    return () => clearTimeout(t)
  }, [justSaved])

  const save = useCallback(
    async (input: Omit<Parameters<typeof recordWeightCapture>[0], 'captureId' | 'profile' | 'context'>) => {
      if (!profile || savingRef.current) return false
      savingRef.current = true
      setSaving(true)
      const captureId = pendingCaptureId.current || createOperationId('wc')
      pendingCaptureId.current = captureId
      try {
        const row = await recordWeightCapture({ ...input, captureId, profile, context })
        pendingCaptureId.current = null
        setRecorded(row)
        setJustSaved(true)
        return true
      } catch (err) {
        Alert.alert('Weight not saved', userFacingMessage(err) || 'Unable to save the weight capture')
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    },
    [profile, context, setRecorded],
  )

  const onCameraConfirm = useCallback(
    (r: ConfirmedCameraReading) =>
      save({
        method: 'CAMERA_OCR',
        weight: r.weight,
        confidence: r.confidence,
        rawText: r.rawText,
        crossCheckAgreed: r.crossCheckAgreed,
        stableFrames: r.stableFrames,
        reviewAcknowledged: r.reviewAcknowledged,
        frameUri: r.frameUri,
      }),
    [save],
  )

  const onManualSubmit = useCallback(
    (e: { weight: number; reason: string; reviewAcknowledged: boolean }) =>
      save({ method: 'MANUAL', weight: e.weight, manualReason: e.reason, reviewAcknowledged: e.reviewAcknowledged }),
    [save],
  )

  if (!scaleId) {
    return <Text style={styles.hint}>Select a scale to start weighing.</Text>
  }

  return (
    <View style={styles.wrap}>
      <WeightCaptureMethodSelector
        methods={methods}
        value={method}
        onChange={setMethod}
        disabled={busy || saving || digital.capturing}
      />

      {method === 'DIGITAL_RS232' ? <StableCapturePanel scaleId={scaleId} capture={digital} busy={busy} /> : null}

      {method !== 'DIGITAL_RS232' && captured ? (
        <View style={styles.locked}>
          <StatusPill
            label={justSaved ? (captured.queued ? 'SAVED OFFLINE' : 'SAVED') : 'WEIGHT LOCKED'}
            tone={captured.queued ? 'warn' : 'ok'}
          />
          <Text style={styles.lockedText}>
            {formatWeight(captured.weight, profile?.resolution)} {captured.unit} · {captureMethodLabel(captured.method)}
            {captured.confidence != null ? ` · ${Math.round(captured.confidence * 100)}%` : ''}
          </Text>
          <Text style={styles.meta}>
            Capture …{String(captured.weightCaptureId || '').slice(-8)}
            {captured.queued ? ' · will sync when online' : ''}
          </Text>
          <BigButton label="CLEAR CAPTURE" onPress={clearCapture} tone="neutral" disabled={busy || saving} />
        </View>
      ) : null}

      {method === 'CAMERA_OCR' && !captured && profile ? (
        <ScaleCameraCapture profile={profile} saving={saving} onConfirm={onCameraConfirm} />
      ) : null}

      {method === 'MANUAL' && !captured && profile ? (
        <ManualWeightEntry profile={profile} saving={saving} onSubmit={onManualSubmit} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hint: { color: colors.textMuted, marginBottom: spacing.sm },
  locked: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  lockedText: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12 },
})
