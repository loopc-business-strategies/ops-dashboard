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
import {
  evaluateStability,
  pushFrame,
  type OcrFrame,
  type StabilityState,
} from '@/src/scaleCamera/weightStability'
import { colors, spacing } from '@/src/theme'

const FRAME_INTERVAL_MS = 700
const MAX_CONSECUTIVE_FAILURES = 5

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

type Locked = { reading: FrameOcrResult; stability: StabilityState; frameUri: string }

type Props = {
  profile: ScaleWeighProfile
  saving?: boolean
  /** Resolve true once the capture record is saved; the component then releases its frame. */
  onConfirm: (reading: ConfirmedCameraReading) => Promise<boolean>
}

function statusView(reading: FrameOcrResult | null, stability: StabilityState | null) {
  if (!reading) return { label: 'STARTING CAMERA', tone: 'neutral' as const, message: '' }
  switch (reading.status) {
    case 'NO_READING':
      return { label: 'NO READING', tone: 'neutral' as const, message: 'Point the camera at the scale display.' }
    case 'LOW_CONFIDENCE':
    case 'ENGINES_DISAGREE':
      return { label: 'LOW CONFIDENCE', tone: 'bad' as const, message: reading.message || LOW_CONFIDENCE_GUIDANCE }
    case 'OUT_OF_RANGE':
      return { label: 'OUT OF RANGE', tone: 'bad' as const, message: reading.message }
    case 'CLIPPED':
      return { label: 'KEEP DISPLAY IN BOX', tone: 'warn' as const, message: reading.message }
    case 'ZERO':
      return { label: 'ZERO', tone: 'neutral' as const, message: reading.message }
    case 'INVALID':
    case 'UNIT_MISMATCH':
      return { label: 'INVALID', tone: 'bad' as const, message: reading.message }
    case 'REVIEW':
    case 'OK':
    default:
      if (stability?.stable) return { label: 'STABLE', tone: 'ok' as const, message: '' }
      return {
        label: 'WAITING FOR STABLE',
        tone: 'warn' as const,
        message: reading.status === 'REVIEW' ? reading.message : 'Hold steady until the reading locks.',
      }
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
 * Scale camera capture: live preview with a guide box, a non-overlapping frame loop that reads
 * the display with on-device OCR, multi-frame stability, and an explicit CONFIRM WEIGHT step.
 * Nothing is recorded until the operator confirms.
 */
export function ScaleCameraCapture({ profile, saving, onConfirm }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const profileRef = useRef(profile)
  profileRef.current = profile

  const focused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [cameraKey, setCameraKey] = useState(0)
  const [ready, setReady] = useState(false)
  const [pictureSize, setPictureSize] = useState<string | undefined>()
  const [previewSize, setPreviewSize] = useState<Size | null>(null)
  const [reading, setReading] = useState<FrameOcrResult | null>(null)
  const [stability, setStability] = useState<StabilityState | null>(null)
  const [locked, setLocked] = useState<Locked | null>(null)
  const [error, setError] = useState('')
  const [stopped, setStopped] = useState(false)
  const [unitAck, setUnitAck] = useState(false)
  const [reviewAck, setReviewAck] = useState(false)
  const framesRef = useRef<OcrFrame[]>([])
  const frameUriRef = useRef<string | null>(null)

  const supported = isCameraOcrSupported()
  const granted = Boolean(permission?.granted)
  const cameraActive = granted && supported && focused && appActive
  const running = cameraActive && ready && !locked && !stopped && previewSize != null

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!cameraActive) setReady(false)
  }, [cameraActive])

  useEffect(
    () => () => {
      discardFrame(frameUriRef.current)
      frameUriRef.current = null
    },
    [],
  )

  const resetReadings = useCallback(() => {
    framesRef.current = []
    setReading(null)
    setStability(null)
    setUnitAck(false)
    setReviewAck(false)
    setError('')
  }, [])

  useEffect(() => {
    if (!running || !previewSize) return
    let cancelled = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (!cancelled) timer = setTimeout(tick, FRAME_INTERVAL_MS)
    }

    const tick = async () => {
      if (cancelled) return
      const cam = cameraRef.current
      if (!cam) {
        schedule()
        return
      }
      let uri: string | null = null
      try {
        const pic = await cam.takePictureAsync({ quality: 0.8, shutterSound: false, skipProcessing: false, exif: false })
        uri = pic.uri
        if (cancelled) {
          discardFrame(uri)
          return
        }
        const current = profileRef.current
        const crop = mapGuideBoxToPhotoCrop(
          guideBoxForPreview(previewSize, guideBoxFractionFor(current)),
          previewSize,
          pic,
        )
        const result = await readScaleFrame(uri, crop, current)
        if (cancelled) {
          discardFrame(uri)
          return
        }
        failures = 0
        framesRef.current = pushFrame(framesRef.current, {
          weight: result.weight,
          confidence: result.confidence,
          at: Date.now(),
        })
        const state = evaluateStability(framesRef.current, current.cameraOcr)
        if (frameUriRef.current && frameUriRef.current !== uri) discardFrame(frameUriRef.current)
        frameUriRef.current = uri
        setReading(result)
        setStability(state)
        setError('')
        if (state.stable && result.weight != null && (result.status === 'OK' || result.status === 'REVIEW')) {
          setLocked({ reading: result, stability: state, frameUri: uri })
          return
        }
      } catch (err) {
        if (uri && uri !== frameUriRef.current) discardFrame(uri)
        failures += 1
        const message = err instanceof Error ? err.message : 'Camera read failed'
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setError(`Camera or OCR keeps failing (${message}). Tap RETRY CAMERA.`)
          setStopped(true)
          return
        }
        setError(message)
      }
      schedule()
    }

    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [running, previewSize, cameraKey])

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

  const retake = useCallback(() => {
    if (locked) discardFrame(locked.frameUri)
    if (frameUriRef.current === locked?.frameUri) frameUriRef.current = null
    setLocked(null)
    resetReadings()
  }, [locked, resetReadings])

  const retryCamera = useCallback(() => {
    discardFrame(frameUriRef.current)
    frameUriRef.current = null
    setLocked(null)
    setReady(false)
    setStopped(false)
    resetReadings()
    setCameraKey((k) => k + 1)
  }, [resetReadings])

  const confirm = useCallback(async () => {
    if (!locked || saving) return
    const ok = await onConfirm({
      weight: locked.reading.weight as number,
      unit: profile.unit,
      confidence: locked.stability.confidence,
      rawText: locked.reading.mlText || locked.reading.sevenText || '',
      crossCheckAgreed: locked.reading.crossCheckAgreed,
      stableFrames: locked.stability.frames,
      frameUri: locked.frameUri,
      reviewAcknowledged: locked.reading.status === 'REVIEW' && reviewAck,
    })
    if (ok) {
      discardFrame(locked.frameUri)
      if (frameUriRef.current === locked.frameUri) frameUriRef.current = null
    }
  }, [locked, saving, onConfirm, profile.unit, reviewAck])

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

  const view = statusView(reading, stability)
  const lockedReading = locked?.reading
  const needsUnitAck = Boolean(lockedReading && !lockedReading.unitDetected)
  const needsReviewAck = lockedReading?.status === 'REVIEW'
  const canConfirm = Boolean(locked) && !saving && (!needsUnitAck || unitAck) && (!needsReviewAck || reviewAck)

  return (
    <View style={styles.block}>
      <View style={styles.preview} onLayout={onLayout}>
        {cameraActive ? (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            active={cameraActive}
            animateShutter={false}
            pictureSize={pictureSize}
            onCameraReady={onCameraReady}
            onMountError={(e) => {
              setError(e?.message || 'Camera unavailable')
              setStopped(true)
            }}
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
                  borderColor: locked ? colors.success : colors.accent,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>
        Fill the box with the GJ display · hold the tablet steady · avoid glare and reflections.
      </Text>

      {locked && lockedReading ? (
        <View style={styles.card}>
          <StatusPill label={needsReviewAck ? 'REVIEW REQUIRED' : 'STABLE'} tone={needsReviewAck ? 'warn' : 'ok'} />
          <View style={styles.lockedRow}>
            <Image source={{ uri: locked.frameUri }} style={styles.thumb} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.weight}>
                {formatWeight(lockedReading.weight as number, profile.resolution)}{' '}
                <Text style={styles.unit}>{profile.unit}</Text>
              </Text>
              <Text style={styles.meta}>
                Confidence {Math.round(locked.stability.confidence * 100)}% · {locked.stability.frames} stable frames
                {lockedReading.crossCheckAgreed ? ' · both OCR engines agree' : ''}
              </Text>
              <Text style={styles.meta}>Compare with the scale display before confirming.</Text>
            </View>
          </View>
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
              label={lockedReading.message || 'Above capacity — I have reviewed this reading'}
            />
          ) : null}
          <BigButton label={saving ? 'SAVING…' : 'CONFIRM WEIGHT'} onPress={confirm} disabled={!canConfirm} />
          <BigButton label="RETAKE" tone="neutral" onPress={retake} disabled={saving} />
        </View>
      ) : (
        <View style={styles.card}>
          <StatusPill label={view.label} tone={view.tone} />
          <Text style={styles.weight}>
            {reading?.displayWeight != null ? formatWeight(reading.displayWeight, profile.resolution) : '—'}{' '}
            <Text style={styles.unit}>{profile.unit}</Text>
          </Text>
          {reading ? (
            <Text style={styles.meta}>
              Confidence {Math.round(reading.confidence * 100)}% (min {Math.round(profile.cameraOcr.minConfidence * 100)}%)
              {stability ? ` · ${stability.frames}/${profile.cameraOcr.consecutiveFrames} frames` : ''}
            </Text>
          ) : null}
          {stability && !stability.stable && stability.frames > 0 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(stability.progress * 100)}%` }]} />
            </View>
          ) : null}
          {view.message ? <Text style={styles.message}>{view.message}</Text> : null}
          {view.label === 'LOW CONFIDENCE' ? <BigButton label="RETRY" tone="neutral" onPress={resetReadings} /> : null}
        </View>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {error || stopped ? <BigButton label="RETRY CAMERA" tone="neutral" onPress={retryCamera} /> : null}
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
  lockedRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 160, height: 90, borderRadius: 6, backgroundColor: '#000' },
  weight: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 20, color: colors.textMuted },
  meta: { color: colors.textMuted, fontSize: 12 },
  message: { color: colors.text, fontSize: 14, fontWeight: '600' },
  err: { color: colors.danger },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.warning },
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
