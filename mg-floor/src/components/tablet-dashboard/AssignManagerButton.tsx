import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress?: () => void
  /** Grey while no employee is logged in. */
  idle?: boolean
  /** The department's assigned manager, shown under the label. */
  managerName?: string
}

export function AssignManagerButton({ onPress, idle, managerName }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={managerName ? `Assign Manager, ${managerName}` : 'Assign Manager'}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, idle && styles.idle, pressed && styles.pressed]}
    >
      <Text style={[styles.text, idle && styles.idleText]}>Assign Manager</Text>
      {managerName ? (
        <Text style={[styles.manager, idle && styles.idleText]} numberOfLines={1}>
          {managerName}
        </Text>
      ) : null}
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
  manager: { color: td.text, fontWeight: '600', fontSize: 13, paddingHorizontal: 8 },
  idleText: { color: td.idleGrey },
})
