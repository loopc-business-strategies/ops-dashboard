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
  isFresh,
  pushFrame,
  stabilityConfigFor,
  stabilitySnapshot,
  stabilityStatus,
  stabilityTolerance,
  withinTolerance,
  type OcrFrame,
  type StabilitySnapshot,
  type StabilityState,
} from '@/src/scaleCamera/weightStability'
import { colors, spacing } from '@/src/theme'

export type ConfirmedCameraReading = {
  weight: number
  unit: string
  confidence: number
  rawText: string
  crossCheckAgreed: boolean | null
  stableFrames: number
  stability: StabilitySnapshot
  frameUri: string
  reviewAcknowledged: boolean
}

type Shot = {
  reading: FrameOcrResult
  frameUri: string
  stability: StabilitySnapshot
  /** Set when the photo's reading does not match the weight that was stable before CAPTURE. */
  mismatch: string | null
}

/** Pause between background reads; each read also takes as long as the photo + OCR. */
const SAMPLE_INTERVAL_MS = 300
const NOT_STABLE_NOTICE_MS = 2500
const PHOTO_OPTIONS = { quality: 0.8, skipProcessing: false, exif: false } as const

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
function failureView(shot: Shot) {
  const { reading } = shot
  if (shot.mismatch) return { label: 'WEIGHT CHANGED', tone: 'bad' as const, message: shot.mismatch }
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
 * Scale camera capture: live preview with a guide box. While the preview is open the display is read
 * silently in the background; CAPTURE only works once several fresh readings over the configured time
 * agree within tolerance. The capture photo must match that stable weight, and nothing is recorded
 * until the operator confirms the weight against the photo.
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
  const [stability, setStability] = useState<StabilityState | null>(null)
  const [notStable, setNotStable] = useState(false)
  const frameUriRef = useRef<string | null>(null)
  /** Bumped whenever background readings must be thrown away; late OCR results from an older session are ignored. */
  const sessionRef = useRef(0)
  const framesRef = useRef<OcrFrame[]>([])
  /** The background read currently using the camera; CAPTURE waits for it so only one photo is taken at a time. */
  const sampleRef = useRef<Promise<void> | null>(null)
  const capturingRef = useRef(false)

  const supported = isCameraOcrSupported()
  const granted = Boolean(permission?.granted)
  const cameraActive = granted && supported && focused && appActive
  const sampling = cameraActive && ready && previewSize != null && !capturing && !shot && !saving
  const canCapture = sampling

  const resetStability = useCallback(() => {
    sessionRef.current += 1
    framesRef.current = []
    setStability(null)
  }, [])

  useEffect(() => {
    if (!sampling || !previewSize) return
    resetStability()
    const session = sessionRef.current
    const live = () => mountedRef.current && sessionRef.current === session
    let timer: ReturnType<typeof setTimeout> | null = null

    const record = (frame: OcrFrame) => {
      framesRef.current = pushFrame(framesRef.current, frame)
      setStability(evaluateStability(framesRef.current, stabilityConfigFor(profileRef.current)))
    }

    const readOnce = async () => {
      const cam = cameraRef.current
      if (!cam || capturingRef.current) return
      let uri: string | null = null
      try {
        const pic = await cam.takePictureAsync({ ...PHOTO_OPTIONS, shutterSound: false })
        uri = pic.uri
        const at = Date.now()
        if (!live()) return
        const current = profileRef.current
        const crop = mapGuideBoxToPhotoCrop(guideBoxForPreview(previewSize, guideBoxFractionFor(current)), previewSize, pic)
        const reading = await readScaleFrame(uri, crop, current)
        if (!live()) return
        record(
          isReadable(reading)
            ? { weight: reading.weight as number, confidence: reading.confidence, at }
            : { weight: null, confidence: 0, at },
        )
      } catch {
        if (live()) record({ weight: null, confidence: 0, at: Date.now() })
      } finally {
        discardFrame(uri)
      }
    }

    const tick = async () => {
      timer = null
      if (!live()) return
      const run = readOnce()
      sampleRef.current = run
      await run
      if (sampleRef.current === run) sampleRef.current = null
      if (live()) timer = setTimeout(tick, SAMPLE_INTERVAL_MS)
    }

    timer = setTimeout(tick, SAMPLE_INTERVAL_MS)
    return () => {
      if (timer) clearTimeout(timer)
      sessionRef.current += 1
    }
  }, [sampling, previewSize, resetStability])

  useEffect(() => {
    if (!notStable) return
    const t = setTimeout(() => setNotStable(false), NOT_STABLE_NOTICE_MS)
    return () => clearTimeout(t)
  }, [notStable])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => sub.remove()
  }, [])

  // Open straight into the camera: ask once on arrival instead of waiting for ALLOW CAMERA.
  const askedPermission = useRef(false)
  useEffect(() => {
    if (!supported || !permission || permission.granted || !permission.canAskAgain || askedPermission.current) return
    askedPermission.current = true
    requestPermission().catch(() => undefined)
  }, [supported, permission, requestPermission])

  useEffect(() => {
    if (!cameraActive) setReady(false)
  }, [cameraActive])

  useEffect(
    () => () => {
      mountedRef.current = false
      sessionRef.current += 1
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
    setNotStable(false)
    resetStability()
  }, [resetStability])

  const capture = useCallback(async () => {
    const cam = cameraRef.current
    if (!cam || !previewSize || capturingRef.current) return
    const current = profileRef.current
    const tolerance = stabilityTolerance(current)
    const frames = framesRef.current
    const state = evaluateStability(frames, stabilityConfigFor(current))
    if (!state.stable || state.weight == null || !isFresh(frames, Date.now())) {
      setNotStable(true)
      return
    }
    const snapshot = stabilitySnapshot(frames, state, tolerance)
    const stableWeight = state.weight
    capturingRef.current = true
    setCapturing(true)
    setNotStable(false)
    setError('')
    let uri: string | null = null
    try {
      const pending = sampleRef.current
      if (pending) await pending.catch(() => undefined)
      const pic = await cam.takePictureAsync({ ...PHOTO_OPTIONS })
      uri = pic.uri
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
      const mismatch =
        isReadable(reading) && !withinTolerance(reading.weight as number, stableWeight, tolerance)
          ? `The photo reads ${formatWeight(reading.weight as number, current.resolution)} ${current.unit} but the scale was stable at ${formatWeight(stableWeight, current.resolution)} ${current.unit}. Hold the item still and RETAKE.`
          : null
      frameUriRef.current = uri
      setShot({ reading, frameUri: uri, stability: snapshot, mismatch })
    } catch (err) {
      discardFrame(uri)
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Camera read failed'
        setError(`${message}. Tap CAPTURE to try again.`)
      }
    } finally {
      capturingRef.current = false
      if (mountedRef.current) setCapturing(false)
    }
  }, [previewSize])

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
    if (!shot || !isReadable(shot.reading) || shot.mismatch || !shot.stability.stable || saving) return
    const { reading, frameUri, stability: snapshot } = shot
    const ok = await onConfirm({
      weight: reading.weight as number,
      unit: profile.unit,
      confidence: reading.confidence,
      rawText: reading.mlText || reading.sevenText || '',
      crossCheckAgreed: reading.crossCheckAgreed,
      stableFrames: snapshot.stableFrames,
      stability: snapshot,
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
          Reading the scale from a photo only works in the MG Floor Android app, not in a browser.
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
  const readable = Boolean(shot && reading && isReadable(reading) && !shot.mismatch && shot.stability.stable)
  const liveStatus = notStable
    ? { label: 'WAIT — WEIGHT NOT STABLE', tone: 'warn' as const }
    : stabilityStatus(stability, (w) => `${formatWeight(w, profile.resolution)} ${profile.unit}`)
  const failure = shot && !readable ? failureView(shot) : null
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
            animateShutter={false}
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
            Fill the box with the GJ display · avoid glare · hold still until it shows STABLE, then tap CAPTURE.
          </Text>
          {cameraActive ? <StatusPill label={capturing ? 'READING SCALE...' : liveStatus.label} tone={capturing ? 'neutral' : liveStatus.tone} /> : null}
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
            {shot ? ` · stable over ${shot.stability.stableFrames} readings (${(shot.stability.durationMs / 1000).toFixed(1)} s)` : ''}
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
      ) : reading && failure ? (
        <View style={styles.card}>
          <StatusPill label={failure.label} tone={failure.tone} />
          {reading.displayWeight != null && !shot?.mismatch ? (
            <Text style={styles.meta}>
              Partly read {formatWeight(reading.displayWeight, profile.resolution)} {profile.unit} — not usable
            </Text>
          ) : null}
          {failure.message ? <Text style={styles.message}>{failure.message}</Text> : null}
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
