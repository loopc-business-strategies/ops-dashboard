import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BigButton, StatusPill, WeightDisplay } from '@/src/components/ui'
import type { useStableScaleCapture } from '@/src/hooks/useStableScaleCapture'
import { colors, spacing } from '@/src/theme'

type CaptureApi = ReturnType<typeof useStableScaleCapture>

/** Shared live weight + capture lock panel for Metal IN/OUT/Transfer. */
export function StableCapturePanel({
  scaleId,
  capture,
  busy,
}: {
  scaleId: string
  capture: CaptureApi
  busy?: boolean
}) {
  const { live, captured, capturing, captureStable, clearCapture } = capture

  if (!scaleId) {
    return <Text style={styles.hint}>Select a scale to start live weighing.</Text>
  }

  return (
    <View style={styles.wrap}>
      <WeightDisplay
        weight={live.weight}
        unit="g"
        stable={live.stable}
        connectionStatus={live.connectionStatus}
        lastReadingAt={live.lastReadingAt}
        onReconnect={live.reconnect}
      />
      {captured ? (
        <View style={styles.locked}>
          <StatusPill label="READING LOCKED" tone="ok" />
          <Text style={styles.lockedText}>
            {captured.weight.toFixed(2)} {captured.unit} · id …{captured.scaleReadingId.slice(-8)}
          </Text>
          {captured.recordedAt ? (
            <Text style={styles.meta}>{new Date(captured.recordedAt).toLocaleString()}</Text>
          ) : null}
          <BigButton
            label="CLEAR CAPTURE"
            onPress={clearCapture}
            tone="neutral"
            disabled={busy || capturing}
          />
        </View>
      ) : (
        <BigButton
          label={capturing ? 'CAPTURING…' : 'CAPTURE STABLE'}
          onPress={() => captureStable()}
          disabled={busy || capturing || !live.stable}
        />
      )}
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
