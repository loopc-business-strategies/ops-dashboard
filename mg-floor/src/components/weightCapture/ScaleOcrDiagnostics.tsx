import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useIsFocused } from 'expo-router'
import { BigButton, StatusPill } from '@/src/components/ui'
import { formatWeight, type ScaleWeighProfile } from '@/src/scaleCamera/cameraSettings'
import { discardFrame } from '@/src/scaleCamera/capturePhoto'
import { guideBoxForPreview, mapGuideBoxToPhotoCrop, pickPictureSize, type Size } from '@/src/scaleCamera/guideBox'
import { clearOcrSamples, countOcrSamples, exportOcrSamples, saveOcrSample } from '@/src/scaleCamera/ocrSampleStore'
import { buildOcrSample, normalizeExpectedDisplay } from '@/src/scaleCamera/ocrSamples'
import {
  guideBoxFractionFor,
  isCameraOcrSupported,
  readScaleFrameDetailed,
  type DetailedFrameOcrResult,
} from '@/src/scaleCamera/scaleOcrService'
import { colors, spacing } from '@/src/theme'

const FRAME_INTERVAL_MS = 900
const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
/** Fills this close to the threshold are the ones a lighting change can flip. */
const NEAR_THRESHOLD = 0.1

type Props = { profile: ScaleWeighProfile }

/**
 * Manager tool for on-site GJ-2000 tuning: runs the capture pipeline live and shows what each OCR
 * engine sees, per digit and per segment. It never records a weight; SAVE SAMPLE stores the processed
 * frame with the value the display really showed so it can be replayed in the test harness.
 */
export function ScaleOcrDiagnostics({ profile }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const profileRef = useRef(profile)
  profileRef.current = profile

  const focused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [ready, setReady] = useState(false)
  const [pictureSize, setPictureSize] = useState<string | undefined>()
  const [previewSize, setPreviewSize] = useState<Size | null>(null)
  const [frozen, setFrozen] = useState(false)
  const [result, setResult] = useState<DetailedFrameOcrResult | null>(null)
  const [error, setError] = useState('')
  const [expected, setExpected] = useState('')
  const [mustNotRead, setMustNotRead] = useState(false)
  const [note, setNote] = useState('')
  const [sampleCount, setSampleCount] = useState(() => countOcrSamples())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const supported = isCameraOcrSupported()
  const cameraActive = Boolean(permission?.granted) && supported && focused && appActive
  const running = cameraActive && ready && !frozen && previewSize != null

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!cameraActive) setReady(false)
  }, [cameraActive])

  useEffect(() => {
    if (!running || !previewSize) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (!cancelled) timer = setTimeout(tick, FRAME_INTERVAL_MS)
    }
    const tick = async () => {
      const cam = cameraRef.current
      if (cancelled || !cam) return schedule()
      let uri: string | null = null
      try {
        const pic = await cam.takePictureAsync({ quality: 0.8, shutterSound: false, skipProcessing: false, exif: false })
        uri = pic.uri
        const current = profileRef.current
        const crop = mapGuideBoxToPhotoCrop(guideBoxForPreview(previewSize, guideBoxFractionFor(current)), previewSize, pic)
        const next = await readScaleFrameDetailed(uri, crop, current)
        if (!cancelled) {
          setResult(next)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Camera read failed')
      } finally {
        discardFrame(uri)
      }
      schedule()
    }
    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [running, previewSize])

  const onCameraReady = useCallback(async () => {
    setReady(true)
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync()
      const size = sizes ? pickPictureSize(sizes) : undefined
      if (size) setPictureSize(size)
    } catch {
      // Default picture size still works.
    }
  }, [])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0) setPreviewSize({ width, height })
  }, [])

  const guideAspect = profile.cameraOcr.guideBoxAspect
  const guideWidth = profile.cameraOcr.guideBoxWidth
  const guide = useMemo(
    () => (previewSize ? guideBoxForPreview(previewSize, { width: guideWidth, aspect: guideAspect }) : null),
    [previewSize, guideWidth, guideAspect],
  )

  const saveSample = () => {
    if (!result || busy) return
    setMessage('')
    const expectedText = mustNotRead ? null : normalizeExpectedDisplay(expected)
    if (!mustNotRead && !expectedText) {
      setError('Type exactly what the scale display shows (e.g. 1250.35), or tick "should not read"')
      return
    }
    try {
      saveOcrSample(
        buildOcrSample({
          id: `${profile.scaleId}-${Date.now()}`,
          capturedAt: new Date(),
          profile,
          frame: result.frame,
          observed: {
            status: result.status,
            displayWeight: result.displayWeight,
            confidence: result.confidence,
            sevenText: result.sevenText,
          },
          expected: expectedText,
          note,
        }),
      )
      setSampleCount(countOcrSamples())
      setMessage('Sample saved')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sample')
    }
  }

  const exportSamples = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const n = await exportOcrSamples()
      setMessage(`Exported ${n} samples`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const clearSamples = () => {
    clearOcrSamples()
    setSampleCount(countOcrSamples())
    setMessage('Samples cleared')
  }

  if (!supported) {
    return <StatusPill label="CAMERA OCR UNAVAILABLE IN THIS BUILD" tone="warn" />
  }
  if (!permission) return <Text style={styles.meta}>Checking camera permission…</Text>
  if (!permission.granted) {
    return (
      <View style={styles.block}>
        <Text style={styles.strong}>MG FLOOR needs camera access to read the scale display.</Text>
        {permission.canAskAgain ? (
          <BigButton label="ALLOW CAMERA" onPress={() => requestPermission().catch(() => undefined)} />
        ) : null}
        <BigButton label="OPEN SETTINGS" tone="neutral" onPress={() => Linking.openSettings().catch(() => undefined)} />
      </View>
    )
  }

  const threshold = profile.cameraOcr.segmentThreshold
  const ok = result?.status === 'OK' || result?.status === 'REVIEW'

  return (
    <View style={styles.block}>
      <View style={styles.preview} onLayout={onLayout}>
        {cameraActive ? (
          <CameraView
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
          <View
            pointerEvents="none"
            style={[styles.guide, { left: guide.x, top: guide.y, width: guide.width, height: guide.height }]}
          />
        ) : null}
      </View>

      <BigButton label={frozen ? 'RESUME' : 'FREEZE'} tone="neutral" onPress={() => setFrozen((v) => !v)} />

      <View style={styles.card}>
        <Text style={styles.meta}>Diagnostics only — nothing here records a weight.</Text>
        {result ? (
          <>
            <StatusPill label={result.status} tone={ok ? 'ok' : 'warn'} />
            <Text style={styles.strong}>
              Reading: {result.displayWeight != null ? formatWeight(result.displayWeight, profile.resolution) : '—'}{' '}
              {profile.unit} · confidence {Math.round(result.confidence * 100)}% (min{' '}
              {Math.round(profile.cameraOcr.minConfidence * 100)}%)
            </Text>
            <Text style={styles.mono}>ML Kit: {result.mlText ? JSON.stringify(result.mlText) : '—'}</Text>
            <Text style={styles.mono}>
              Seven-segment: {result.sevenText ?? (result.seven?.reason ? `— (${result.seven.reason})` : '—')}
            </Text>
            <Text style={styles.meta}>
              Engines agree: {result.crossCheckAgreed == null ? '—' : result.crossCheckAgreed ? 'YES' : 'NO'} · crop{' '}
              {result.frame.width}×{result.frame.height} · {result.processingMs} ms · threshold {threshold}
            </Text>
            {result.message ? <Text style={styles.meta}>{result.message}</Text> : null}
            {(result.seven?.digits || []).map((d, i) => (
              <View key={`${i}-${d.x0}`} style={styles.digitRow}>
                <Text style={styles.digitChar}>{d.char}</Text>
                <Text style={styles.meta}>{Math.round(d.confidence * 100)}%</Text>
                {d.fills ? (
                  d.fills.map((f, s) => (
                    <Text
                      key={SEGMENT_NAMES[s]}
                      style={[
                        styles.fill,
                        f >= threshold ? styles.fillOn : null,
                        Math.abs(f - threshold) < NEAR_THRESHOLD ? styles.fillNear : null,
                      ]}
                    >
                      {SEGMENT_NAMES[s]} {f.toFixed(2)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.meta}>narrow glyph</Text>
                )}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.meta}>Waiting for the first frame…</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.strong}>SAVE SAMPLE ({sampleCount} saved on this tablet)</Text>
        <TextInput
          style={styles.input}
          value={expected}
          onChangeText={setExpected}
          editable={!mustNotRead}
          keyboardType="decimal-pad"
          placeholder="Exactly what the display shows, e.g. 1250.35"
          placeholderTextColor={colors.textMuted}
        />
        <BigButton
          label={mustNotRead ? '✓ SHOULD NOT READ (glare / clipped / blank)' : 'SHOULD NOT READ (glare / clipped / blank)'}
          tone="neutral"
          onPress={() => setMustNotRead((v) => !v)}
        />
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="Note (lighting, distance…)"
          placeholderTextColor={colors.textMuted}
        />
        <BigButton label="SAVE SAMPLE" onPress={saveSample} disabled={!result || busy} />
        <BigButton label={busy ? 'EXPORTING…' : 'EXPORT SAMPLES'} tone="neutral" onPress={exportSamples} disabled={busy || !sampleCount} />
        <BigButton label="CLEAR SAMPLES" tone="danger" onPress={clearSamples} disabled={busy || !sampleCount} />
      </View>

      {message ? <Text style={styles.okText}>{message}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  preview: { height: 320, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  paused: { alignItems: 'center', justifyContent: 'center' },
  pausedText: { color: '#fff', fontWeight: '700' },
  guide: { position: 'absolute', borderWidth: 3, borderRadius: 6, borderColor: colors.accent },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  strong: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12 },
  mono: { color: colors.text, fontFamily: 'monospace', fontSize: 13 },
  digitRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  digitChar: { color: colors.text, fontWeight: '800', fontSize: 20, width: 20 },
  fill: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  fillOn: { color: colors.onAccent, backgroundColor: colors.accent },
  fillNear: { borderWidth: 1, borderColor: colors.warning },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  okText: { color: colors.success, fontWeight: '700' },
  err: { color: colors.danger },
})
