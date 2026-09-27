import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { CaptureMethod } from '@/src/scaleCamera/cameraSettings'
import { captureMethodLabel } from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'

export function WeightCaptureMethodSelector({
  methods,
  value,
  onChange,
  disabled,
}: {
  methods: CaptureMethod[]
  value: CaptureMethod
  onChange: (method: CaptureMethod) => void
  disabled?: boolean
}) {
  if (methods.length < 2) return null
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {methods.map((m) => {
        const active = m === value
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(m)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{captureMethodLabel(m)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  option: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  optionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.text, fontWeight: '800', letterSpacing: 0.5 },
  labelActive: { color: colors.onAccent },
})
