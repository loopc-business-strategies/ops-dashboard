import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress: () => void
  disabled?: boolean
  label?: string
}

export function CallFMButton({ onPress, disabled, label = 'Call F.M' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        !disabled && buttonShadow,
        pressed && styles.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.orange,
    borderWidth: 2,
    borderColor: td.orange,
    borderRadius: td.buttonRadius,
  },
  pressed: {
    backgroundColor: td.orangePressed,
    borderColor: td.orangePressed,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: td.white,
    fontFamily: td.buttonFont,
    fontWeight: '600',
    fontSize: 24,
    letterSpacing: 0.8,
  },
})
