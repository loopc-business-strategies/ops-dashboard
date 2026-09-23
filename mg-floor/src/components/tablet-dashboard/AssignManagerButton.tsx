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
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.85 : 1 }]}
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
    borderRadius: td.radius,
  },
  text: {
    color: td.orange,
    fontWeight: '800',
    fontSize: 18,
  },
})

