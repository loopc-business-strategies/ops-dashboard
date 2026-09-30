import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress?: () => void
  /** Grey while no employee is logged in. */
  idle?: boolean
}

export function AssignManagerButton({ onPress, idle }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, idle && styles.idle, pressed && styles.pressed]}
    >
      <Text style={[styles.text, idle && styles.idleText]}>Assign Manager</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.white,
    borderWidth: 2,
    borderColor: td.orange,
    borderRadius: td.buttonRadius,
  },
  idle: { borderColor: td.idleGrey },
  pressed: {
    backgroundColor: td.cream,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: td.orange,
    fontFamily: td.buttonFont,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  idleText: { color: td.idleGrey },
})
