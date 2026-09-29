import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress?: () => void
}

/** Visual stub — Assign Manager wiring added later. */
export function AssignManagerButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={styles.text}>Assign Manager</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.white,
    borderWidth: 2,
    borderColor: td.orange,
    borderRadius: td.buttonRadius,
  },
  pressed: {
    backgroundColor: td.cream,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: td.orange,
    fontFamily: td.buttonFont,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.6,
  },
})
