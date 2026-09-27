import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { archiveScale, updateScale } from '@/src/api/floor'
import { userFacingMessage } from '@/src/api/errors'
import { BigButton } from '@/src/components/ui'
import {
  CAMERA_OCR_LIMITS,
  toWeighProfile,
  type OverCapacityPolicy,
  type ScaleCaptureMethod,
} from '@/src/scaleCamera/cameraSettings'
import { colors, spacing } from '@/src/theme'

type Props = {
  scale: Record<string, unknown>
  onSaved: () => void
  onClose: () => void
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggle, value && styles.toggleOn]}
    >
      <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? '✓ ' : ''}{label}</Text>
    </Pressable>
  )
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textMuted}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

function inRange(raw: string, [min, max]: readonly [number, number], label: string) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`)
  return n
}

/** Manager-only camera capture profile and removal for one registry scale. */
export function ScaleCameraSettingsEditor({ scale, onSaved, onClose }: Props) {
  const profile = toWeighProfile(scale as Parameters<typeof toWeighProfile>[0])
  const scaleId = profile.scaleId
  const [digital, setDigital] = useState(profile.captureMethods.includes('DIGITAL_RS232'))
  const [camera, setCamera] = useState(profile.captureMethods.includes('CAMERA_OCR'))
  const [capacity, setCapacity] = useState(profile.capacity != null ? String(profile.capacity) : '')
  const [resolution, setResolution] = useState(profile.resolution != null ? String(profile.resolution) : '')
  const [enabled, setEnabled] = useState(profile.cameraOcr.enabled)
  const [minConfidence, setMinConfidence] = useState(String(profile.cameraOcr.minConfidence))
  const [frames, setFrames] = useState(String(profile.cameraOcr.consecutiveFrames))
  const [durationMs, setDurationMs] = useState(String(profile.cameraOcr.stableDurationMs))
  const [variation, setVariation] = useState(String(profile.cameraOcr.allowedVariation))
  const [imageQuality, setImageQuality] = useState(String(profile.cameraOcr.imageQuality))
  const [policy, setPolicy] = useState<OverCapacityPolicy>(profile.cameraOcr.overCapacityPolicy)
  const [crossCheck, setCrossCheck] = useState(profile.cameraOcr.sevenSegmentCrossCheck)
  const [segmentThreshold, setSegmentThreshold] = useState(String(profile.cameraOcr.segmentThreshold))
  const [guideAspect, setGuideAspect] = useState(String(profile.cameraOcr.guideBoxAspect))
  const [guideWidth, setGuideWidth] = useState(String(profile.cameraOcr.guideBoxWidth))
  const [removeReason, setRemoveReason] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const save = async () => {
    if (busy) return
    setError('')
    setMessage('')
    try {
      const methods: ScaleCaptureMethod[] = [
        ...(digital ? (['DIGITAL_RS232'] as const) : []),
        ...(camera ? (['CAMERA_OCR'] as const) : []),
      ]
      if (!methods.length) throw new Error('Enable at least one capture method')
      const patch = {
        captureMethods: methods,
        capacity: capacity.trim() ? inRange(capacity, [0.000001, 1e7], 'Capacity') : null,
        resolution: resolution.trim() ? inRange(resolution, [0.000001, 1000], 'Resolution') : null,
        cameraOcr: {
          enabled,
          minConfidence: inRange(minConfidence, CAMERA_OCR_LIMITS.minConfidence, 'Minimum confidence'),
          consecutiveFrames: Math.round(inRange(frames, CAMERA_OCR_LIMITS.consecutiveFrames, 'Consecutive frames')),
          stableDurationMs: Math.round(inRange(durationMs, CAMERA_OCR_LIMITS.stableDurationMs, 'Stable duration')),
          allowedVariation: inRange(variation, CAMERA_OCR_LIMITS.allowedVariation, 'Allowed variation'),
          imageQuality: inRange(imageQuality, CAMERA_OCR_LIMITS.imageQuality, 'Photo quality'),
          overCapacityPolicy: policy,
          sevenSegmentCrossCheck: crossCheck,
          segmentThreshold: inRange(segmentThreshold, CAMERA_OCR_LIMITS.segmentThreshold, 'Segment threshold'),
          guideBoxAspect: inRange(guideAspect, CAMERA_OCR_LIMITS.guideBoxAspect, 'Guide box aspect'),
          guideBoxWidth: inRange(guideWidth, CAMERA_OCR_LIMITS.guideBoxWidth, 'Guide box width'),
        },
      }
      setBusy(true)
      await updateScale(scaleId, patch)
      setMessage('Saved')
      onSaved()
    } catch (err) {
      setError(userFacingMessage(err) || (err instanceof Error ? err.message : 'Save failed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    if (removeReason.trim().length < 3) {
      setError('Enter a reason (min 3 characters) to remove this scale')
      return
    }
    setBusy(true)
    setError('')
    try {
      await archiveScale(scaleId, removeReason.trim())
      onSaved()
      onClose()
    } catch (err) {
      setError(userFacingMessage(err) || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>CAPTURE SETTINGS — {scaleId}</Text>
      <Text style={styles.label}>Capture methods</Text>
      <View style={styles.row}>
        <Toggle label="DIGITAL (RS-232)" value={digital} onChange={setDigital} />
        <Toggle label="SCALE CAMERA (OCR)" value={camera} onChange={setCamera} />
      </View>
      {digital ? <Text style={styles.hint}>Digital capture needs a gateway assignment (set in the web admin).</Text> : null}

      <View style={styles.row}>
        <NumberField label={`Capacity (${profile.unit})`} value={capacity} onChange={setCapacity} hint="GJ-2000: 2200" />
        <NumberField label={`Resolution (${profile.unit})`} value={resolution} onChange={setResolution} hint="GJ-2000: 0.01" />
      </View>

      <Text style={styles.label}>Camera OCR</Text>
      <View style={styles.row}>
        <Toggle label="Camera capture enabled" value={enabled} onChange={setEnabled} />
        <Toggle label="Seven-segment cross-check" value={crossCheck} onChange={setCrossCheck} />
      </View>
      <View style={styles.row}>
        <NumberField label="Min confidence (0.6–1)" value={minConfidence} onChange={setMinConfidence} />
        <NumberField label="Consecutive frames" value={frames} onChange={setFrames} />
      </View>
      <View style={styles.row}>
        <NumberField label="Stable duration (ms)" value={durationMs} onChange={setDurationMs} />
        <NumberField label={`Allowed variation (${profile.unit})`} value={variation} onChange={setVariation} />
      </View>
      <View style={styles.row}>
        <NumberField label="Photo quality (0.2–1)" value={imageQuality} onChange={setImageQuality} />
        <View style={styles.field}>
          <Text style={styles.label}>Above capacity</Text>
          <View style={styles.row}>
            <Toggle label="REJECT" value={policy === 'REJECT'} onChange={() => setPolicy('REJECT')} />
            <Toggle label="REVIEW" value={policy === 'REVIEW'} onChange={() => setPolicy('REVIEW')} />
          </View>
        </View>
      </View>

      <Text style={styles.label}>Decoder tuning (use SCALE OCR DIAGNOSTICS to check)</Text>
      <View style={styles.row}>
        <NumberField
          label="Segment threshold (0.15–0.6)"
          value={segmentThreshold}
          onChange={setSegmentThreshold}
          hint="Lower if dim segments are missed; raise if unlit segments read as on"
        />
        <NumberField
          label="Guide box aspect (2–6)"
          value={guideAspect}
          onChange={setGuideAspect}
          hint="Width ÷ height of the display window"
        />
        <NumberField
          label="Guide box width (0.5–0.9)"
          value={guideWidth}
          onChange={setGuideWidth}
          hint="Share of the preview width"
        />
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <BigButton label={busy ? 'SAVING…' : 'SAVE SETTINGS'} onPress={save} disabled={busy} />

      {confirmRemove ? (
        <View style={styles.removeBox}>
          <Text style={styles.label}>Remove {scaleId} from the registry (history is kept)</Text>
          <TextInput
            style={styles.input}
            value={removeReason}
            onChangeText={setRemoveReason}
            placeholder="Reason"
            placeholderTextColor={colors.textMuted}
          />
          <BigButton label={busy ? 'REMOVING…' : 'CONFIRM REMOVE'} tone="danger" onPress={remove} disabled={busy} />
        </View>
      ) : (
        <BigButton label="REMOVE SCALE" tone="danger" onPress={() => setConfirmRemove(true)} disabled={busy} />
      )}
      <BigButton label="CLOSE" tone="neutral" onPress={onClose} disabled={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  title: { color: colors.accent, fontWeight: '800', letterSpacing: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { flex: 1, minWidth: 160, gap: 4 },
  label: { color: colors.text, fontWeight: '700', marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12 },
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
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.text, fontWeight: '700' },
  toggleTextOn: { color: colors.onAccent },
  err: { color: colors.danger },
  ok: { color: colors.success, fontWeight: '700' },
  removeBox: { gap: 6, marginTop: spacing.sm },
})
