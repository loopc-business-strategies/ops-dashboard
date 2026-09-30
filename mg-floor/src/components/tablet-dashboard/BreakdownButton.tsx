import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress: () => void
  /** Grey while no employee is logged in. */
  idle?: boolean
  /** Shown under the label while a reported breakdown waits for the Floor Manager. */
  status?: string
}

export function BreakdownButton({ onPress, idle, status }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status ? `Breakdown, ${status}` : 'Breakdown'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        idle && styles.idle,
        !idle && buttonShadow,
        pressed && (idle ? styles.idlePressed : styles.pressed),
      ]}
    >
      <Text style={styles.text}>BREAKDOWN</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.red,
    borderWidth: 2,
    borderColor: td.red,
    borderRadius: td.buttonRadius,
  },
  idle: {
    backgroundColor: td.idleGrey,
    borderColor: td.idleGrey,
  },
  pressed: {
    backgroundColor: td.redPressed,
    borderColor: td.redPressed,
    transform: [{ scale: 0.98 }],
  },
  idlePressed: {
    backgroundColor: td.idleGreyPressed,
    borderColor: td.idleGreyPressed,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: td.white,
    fontFamily: td.buttonFont,
    fontWeight: '700',
    fontSize: 28,
    letterSpacing: 1,
  },
  status: {
    color: td.white,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
})
