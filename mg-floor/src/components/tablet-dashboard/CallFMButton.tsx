import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

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
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
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
    borderRadius: td.radius,
  },
  text: {
    color: td.white,
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: 0.4,
  },
})

