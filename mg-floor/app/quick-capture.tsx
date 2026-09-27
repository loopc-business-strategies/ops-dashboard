import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { BackBar, Screen } from '@/src/components/ui'
import { ErrorState, SectionLoading } from '@/src/components/async'
import { ScaleCameraCapture, type ConfirmedCameraReading } from '@/src/components/weightCapture/ScaleCameraCapture'
import { setPendingFill, type CaptureSide } from '@/src/components/tablet-dashboard/captureFill'
import { userFacingMessage } from '@/src/api/errors'
import { useAuth } from '@/src/context/AuthContext'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId } from '@/src/offline/outbox'
import { formatWeight, supportsCameraOcr } from '@/src/scaleCamera/cameraSettings'
import { recordWeightCapture } from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'

/**
 * Dashboard CAPTURE WEIGHT: opens the scale camera straight away on the first authorised
 * camera-enabled scale. A confirmed reading is saved as a weight capture and handed back to the
 * dashboard table; it does not create a Metal IN/OUT transaction.
 */
export default function QuickCaptureScreen() {
  const params = useLocalSearchParams<{ side?: string }>()
  const side: CaptureSide = params.side === 'out' ? 'out' : 'in'
  const router = useRouter()
  const { user } = useAuth()
  const scales = useAuthorizedScaleIds(user?.department)
  const [saving, setSaving] = useState(false)
  /** Reused if a save attempt fails so the retry stays idempotent server-side. */
  const pendingCaptureId = useRef<string | null>(null)

  const profile = useMemo(() => {
    for (const id of scales.ids) {
      const p = scales.profiles[id]
      if (p && supportsCameraOcr(p)) return p
    }
    return null
  }, [scales.ids, scales.profiles])

  const onConfirm = useCallback(
    async (r: ConfirmedCameraReading) => {
      if (!profile || saving) return false
      setSaving(true)
      const captureId = pendingCaptureId.current || createOperationId('wc')
      pendingCaptureId.current = captureId
      try {
        const saved = await recordWeightCapture({
          captureId,
          method: 'CAMERA_OCR',
          profile,
          weight: r.weight,
          confidence: r.confidence,
          rawText: r.rawText,
          crossCheckAgreed: r.crossCheckAgreed,
          stableFrames: r.stableFrames,
          reviewAcknowledged: r.reviewAcknowledged,
          frameUri: r.frameUri,
          context: { department: user?.department },
        })
        pendingCaptureId.current = null
        setPendingFill({
          side,
          qty: `${formatWeight(saved.weight, profile.resolution)} ${saved.unit}`,
          at: saved.capturedAt,
        })
        if (router.canGoBack()) router.back()
        else router.replace('/')
        return true
      } catch (err) {
        Alert.alert('Weight not saved', userFacingMessage(err) || 'Unable to save the weight capture')
        return false
      } finally {
        setSaving(false)
      }
    },
    [profile, saving, side, user?.department, router],
  )

  const title = side === 'out' ? 'METAL OUT — CAPTURE' : 'METAL IN — CAPTURE'
  const loading = !profile && ['idle', 'loading', 'retrying'].includes(scales.status)

  return (
    <Screen>
      <BackBar title={title} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {profile ? (
          <>
            <Text style={styles.scale}>Scale {profile.scaleId}</Text>
            <ScaleCameraCapture profile={profile} saving={saving} onConfirm={onConfirm} />
          </>
        ) : loading ? (
          <SectionLoading label="Loading scale…" />
        ) : scales.status === 'error' && !scales.ids.length ? (
          <ErrorState message={scales.error || 'Unable to load scales'} onRetry={scales.reload} />
        ) : (
          <Text style={styles.err}>No camera scale is set up. Ask a manager.</Text>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  scale: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  err: { color: colors.danger, marginVertical: spacing.md },
})
