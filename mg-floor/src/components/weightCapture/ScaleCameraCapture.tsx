import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useIsFocused } from 'expo-router'
import { BigButton, StatusPill } from '@/src/components/ui'
import { formatWeight, type ScaleWeighProfile } from '@/src/scaleCamera/cameraSettings'
import { discardFrame } from '@/src/scaleCamera/capturePhoto'
import { guideBoxForPreview, mapGuideBoxToPhotoCrop, pickPictureSize, type Size } from '@/src/scaleCamera/guideBox'
import { LOW_CONFIDENCE_GUIDANCE } from '@/src/scaleCamera/ocrCombine'
import {
  guideBoxFractionFor,
  isCameraOcrSupported,
  readScaleFrame,
  type FrameOcrResult,
} from '@/src/scaleCamera/scaleOcrService'
import { colors, spacing } from '@/src/theme'

export type ConfirmedCameraReading = {
  weight: number
  unit: string
  confidence: number
  rawText: string
  crossCheckAgreed: boolean | null
  stableFrames: number
  frameUri: string
  reviewAcknowledged: boolean
}

type Shot = { reading: FrameOcrResult; frameUri: string }

type Props = {
  profile: ScaleWeighProfile
  saving?: boolean
  /** Resolve true once the capture record is saved; the component then releases its frame. */
  onConfirm: (reading: ConfirmedCameraReading) => Promise<boolean>
}

function isReadable(reading: FrameOcrResult) {
  return reading.weight != null && (reading.status === 'OK' || reading.status === 'REVIEW')
}

/** Why a captured photo could not be used. */
function failureView(reading: FrameOcrResult) {
  switch (reading.status) {
    case 'NO_READING':
      return { label: 'NO READING', tone: 'neutral' as const, message: 'No digits found. Point the camera at the scale display.' }
    case 'LOW_CONFIDENCE':
    case 'ENGINES_DISAGREE':
      return { label: 'NOT CLEAR', tone: 'bad' as const, message: reading.message || LOW_CONFIDENCE_GUIDANCE }
    case 'OUT_OF_RANGE':
      return { label: 'OUT OF RANGE', tone: 'bad' as const, message: reading.message }
    case 'CLIPPED':
      return { label: 'KEEP DISPLAY IN BOX', tone: 'warn' as const, message: reading.message }
    case 'ZERO':
      return { label: 'ZERO', tone: 'neutral' as const, message: reading.message || 'The display reads zero.' }
    default:
      return { label: 'INVALID', tone: 'bad' as const, message: reading.message }
  }
}

function AckRow({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.ackRow}>
      <View style={[styles.ackBox, checked && styles.ackBoxOn]}>{checked ? <Text style={styles.ackTick}>✓</Text> : null}</View>
      <Text style={styles.ackLabel}>{label}</Text>
    </Pressable>
  )
}

/**
 * Scale camera capture: live preview with a guide box; the operator taps CAPTURE to take one photo,
 * the display is read with on-device OCR, and nothing is recorded until the operator confirms the
 * weight against the photo. A single photo cannot prove the display had settled, so the operator
 * must also confirm it was steady.
 */
export function ScaleCameraCapture({ profile, saving, onConfirm }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const profileRef = useRef(profile)
  profileRef.current = profile
  const mountedRef = useRef(true)

  const focused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [cameraKey, setCameraKey] = useState(0)
  const [ready, setReady] = useState(false)
  const [pictureSize, setPictureSize] = useState<string | undefined>()
  const [previewSize, setPreviewSize] = useState<Size | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [error, setError] = useState('')
  const [steadyAck, setSteadyAck] = useState(false)
  const [unitAck, setUnitAck] = useState(false)
  const [reviewAck, setReviewAck] = useState(false)
  const frameUriRef = useRef<string | null>(null)

  const supported = isCameraOcrSupported()
  const granted = Boolean(permission?.granted)
  const cameraActive = granted && supported && focused && appActive
  const canCapture = cameraActive && ready && previewSize != null && !capturing && !shot && !saving

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!cameraActive) setReady(false)
  }, [cameraActive])

  useEffect(
    () => () => {
      mountedRef.current = false
      discardFrame(frameUriRef.current)
      frameUriRef.current = null
    },
    [],
  )

  const clearShot = useCallback(() => {
    discardFrame(frameUriRef.current)
    frameUriRef.current = null
    setShot(null)
    setReady(false)
    setSteadyAck(false)
    setUnitAck(false)
    setReviewAck(false)
    setError('')
  }, [])

  const capture = useCallback(async () => {
    const cam = cameraRef.current
    if (!cam || !previewSize || capturing) return
    setCapturing(true)
    setError('')
    let uri: string | null = null
    try {
      const pic = await cam.takePictureAsync({ quality: 0.8, skipProcessing: false, exif: false })
      uri = pic.uri
      const current = profileRef.current
      const crop = mapGuideBoxToPhotoCrop(
        guideBoxForPreview(previewSize, guideBoxFractionFor(current)),
        previewSize,
        pic,
      )
      const reading = await readScaleFrame(uri, crop, current)
      if (!mountedRef.current) {
        discardFrame(uri)
        return
      }
      frameUriRef.current = uri
      setShot({ reading, frameUri: uri })
    } catch (err) {
      discardFrame(uri)
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Camera read failed'
        setError(`${message}. Tap CAPTURE to try again.`)
      }
    } finally {
      if (mountedRef.current) setCapturing(false)
    }
  }, [previewSize, capturing])

  const onCameraReady = useCallback(async () => {
    setReady(true)
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync()
      const size = sizes ? pickPictureSize(sizes) : undefined
      if (size) setPictureSize(size)
    } catch {
      // Default picture size still works, just slower.
    }
  }, [])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0) setPreviewSize({ width, height })
  }, [])

  const retryCamera = useCallback(() => {
    clearShot()
    setReady(false)
    setCameraKey((k) => k + 1)
  }, [clearShot])

  const confirm = useCallback(async () => {
    if (!shot || !isReadable(shot.reading) || saving) return
    const { reading, frameUri } = shot
    const ok = await onConfirm({
      weight: reading.weight as number,
      unit: profile.unit,
      confidence: reading.confidence,
      rawText: reading.mlText || reading.sevenText || '',
      crossCheckAgreed: reading.crossCheckAgreed,
      stableFrames: 1,
      frameUri,
      reviewAcknowledged: reading.status === 'REVIEW' && reviewAck,
    })
    if (ok) {
      discardFrame(frameUri)
      if (frameUriRef.current === frameUri) frameUriRef.current = null
    }
  }, [shot, saving, onConfirm, profile.unit, reviewAck])

  const guideAspect = profile.cameraOcr.guideBoxAspect
  const guideWidth = profile.cameraOcr.guideBoxWidth
  const guide = useMemo(
    () => (previewSize ? guideBoxForPreview(previewSize, { width: guideWidth, aspect: guideAspect }) : null),
    [previewSize, guideWidth, guideAspect],
  )

  if (!supported) {
    return (
      <View style={styles.block}>
        <StatusPill label="CAMERA OCR UNAVAILABLE" tone="warn" />
        <Text style={styles.hint}>
          This app build has no on-device OCR. Use the digital scale or ask a manager for manual entry.
        </Text>
      </View>
    )
  }

  if (!permission) {
    return <Text style={styles.hint}>Checking camera permission…</Text>
  }

  if (!permission.granted) {
    return (
      <View style={styles.block}>
        <Text style={styles.permissionText}>MG FLOOR needs camera access to read the scale display.</Text>
        {permission.canAskAgain ? (
          <BigButton label="ALLOW CAMERA" onPress={() => requestPermission().catch(() => undefined)} />
        ) : null}
        <BigButton label="OPEN SETTINGS" tone="neutral" onPress={() => Linking.openSettings().catch(() => undefined)} />
      </View>
    )
  }

  const reading = shot?.reading ?? null
  const readable = Boolean(reading && isReadable(reading))
  const needsUnitAck = Boolean(readable && reading && !reading.unitDetected)
  const needsReviewAck = readable && reading?.status === 'REVIEW'
  const canConfirm =
    readable && !saving && steadyAck && (!needsUnitAck || unitAck) && (!needsReviewAck || reviewAck)

  return (
    <View style={styles.block}>
      <View style={styles.preview} onLayout={onLayout}>
        {shot ? (
          <Image source={{ uri: shot.frameUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : cameraActive ? (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            active={cameraActive}
            animateShutter
            pictureSize={pictureSize}
            onCameraReady={onCameraReady}
            onMountError={(e) => setError(e?.message || 'Camera unavailable')}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.paused]}>
            <Text style={styles.pausedText}>Camera paused</Text>
          </View>
        )}
        {guide ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.shade, { left: 0, right: 0, top: 0, height: guide.y }]} />
            <View style={[styles.shade, { left: 0, right: 0, top: guide.y + guide.height, bottom: 0 }]} />
            <View style={[styles.shade, { left: 0, width: guide.x, top: guide.y, height: guide.height }]} />
            <View
              style={[styles.shade, { left: guide.x + guide.width, right: 0, top: guide.y, height: guide.height }]}
            />
            <View
              style={[
                styles.guide,
                {
                  left: guide.x,
                  top: guide.y,
                  width: guide.width,
                  height: guide.height,
                  borderColor: shot ? (readable ? colors.success : colors.danger) : colors.accent,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      {!shot ? (
        <>
          <Text style={styles.hint}>
            Fill the box with the GJ display · wait until the number stops changing · avoid glare, then tap CAPTURE.
          </Text>
          <BigButton label={capturing ? 'READING…' : 'CAPTURE'} onPress={capture} disabled={!canCapture} />
        </>
      ) : readable && reading ? (
        <View style={styles.card}>
          <StatusPill label={needsReviewAck ? 'REVIEW REQUIRED' : 'READ'} tone={needsReviewAck ? 'warn' : 'ok'} />
          <Text style={styles.weight}>
            {formatWeight(reading.weight as number, profile.resolution)} <Text style={styles.unit}>{profile.unit}</Text>
          </Text>
          <Text style={styles.meta}>
            Confidence {Math.round(reading.confidence * 100)}%
            {reading.crossCheckAgreed ? ' · both OCR engines agree' : ''}
          </Text>
          <Text style={styles.message}>Compare this number with the photo above before confirming.</Text>
          <AckRow
            checked={steadyAck}
            onToggle={() => setSteadyAck((v) => !v)}
            label="The display was steady (not changing) when I took this photo"
          />
          {needsUnitAck ? (
            <AckRow
              checked={unitAck}
              onToggle={() => setUnitAck((v) => !v)}
              label={`Unit not read — I confirm the display shows ${profile.unit}`}
            />
          ) : null}
          {needsReviewAck ? (
            <AckRow
              checked={reviewAck}
              onToggle={() => setReviewAck((v) => !v)}
              label={reading.message || 'Above capacity — I have reviewed this reading'}
            />
          ) : null}
          <BigButton label={saving ? 'SAVING…' : 'CONFIRM WEIGHT'} onPress={confirm} disabled={!canConfirm} />
          <BigButton label="RETAKE" tone="neutral" onPress={clearShot} disabled={saving} />
        </View>
      ) : reading ? (
        <View style={styles.card}>
          <StatusPill label={failureView(reading).label} tone={failureView(reading).tone} />
          {reading.displayWeight != null ? (
            <Text style={styles.meta}>
              Partly read {formatWeight(reading.displayWeight, profile.resolution)} {profile.unit} — not usable
            </Text>
          ) : null}
          {failureView(reading).message ? <Text style={styles.message}>{failureView(reading).message}</Text> : null}
          <BigButton label="RETAKE" onPress={clearShot} />
        </View>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {error && !shot ? <BigButton label="RETRY CAMERA" tone="neutral" onPress={retryCamera} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  preview: {
    height: 320,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  paused: { alignItems: 'center', justifyContent: 'center' },
  pausedText: { color: '#fff', fontWeight: '700' },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)' },
  guide: { position: 'absolute', borderWidth: 3, borderRadius: 6 },
  hint: { color: colors.textMuted, fontSize: 13 },
  permissionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  weight: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, color: colors.textMuted },
  meta: { color: colors.textMuted, fontSize: 12 },
  message: { color: colors.text, fontSize: 14, fontWeight: '600' },
  err: { color: colors.danger },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  ackBox: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  ackTick: { color: colors.onAccent, fontWeight: '800' },
  ackLabel: { color: colors.text, flex: 1, fontWeight: '600' },
})
