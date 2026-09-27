import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { BackBar, Screen } from '@/src/components/ui'
import { SectionLoading } from '@/src/components/async'
import { ScaleCameraCapture, type ConfirmedCameraReading } from '@/src/components/weightCapture/ScaleCameraCapture'
import { setPendingFill, type CaptureSide } from '@/src/components/tablet-dashboard/captureFill'
import { userFacingMessage } from '@/src/api/errors'
import { useAuth } from '@/src/context/AuthContext'
import { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { createOperationId } from '@/src/offline/outbox'
import {
  DEFAULT_CAMERA_SCALE_ID,
  DEFAULT_CAMERA_SCALE_PROFILE,
  formatWeight,
  supportsCameraOcr,
} from '@/src/scaleCamera/cameraSettings'
import { recordWeightCapture } from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'

/**
 * Dashboard CAPTURE WEIGHT: opens the scale camera straight away on the first authorised
 * camera-enabled scale, or the built-in MG-CAMERA scale when none is registered (also when the
 * scale list can't be loaded). A confirmed reading is saved as a weight capture and handed back to the
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

  const loading = ['idle', 'loading', 'retrying'].includes(scales.status)
  const defaultTurnedOff = useMemo(() => {
    const p = scales.profiles[DEFAULT_CAMERA_SCALE_ID]
    return Boolean(p && !supportsCameraOcr(p))
  }, [scales.profiles])

  const profile = useMemo(() => {
    for (const id of scales.ids) {
      const p = scales.profiles[id]
      if (p && supportsCameraOcr(p)) return p
    }
    if (loading || defaultTurnedOff) return null
    return DEFAULT_CAMERA_SCALE_PROFILE
  }, [scales.ids, scales.profiles, loading, defaultTurnedOff])

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
        ) : (
          <Text style={styles.err}>Camera capture has been turned off by a manager.</Text>
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
