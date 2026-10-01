import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'

type Props = {
  onPress: () => void
  disabled?: boolean
  label?: string
  /** Grey while no employee is logged in. */
  idle?: boolean
  /** Shown under the label while a call waits for the Floor Manager, or once the F.M is coming. */
  status?: string
}

export function CallFMButton({ onPress, disabled, label = 'Call F.M', idle, status }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status ? `${label}, ${status}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        idle && styles.idle,
        !disabled && !idle && buttonShadow,
        pressed && (idle ? styles.idlePressed : styles.pressed),
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.orange,
    borderWidth: 2,
    borderColor: td.orange,
    borderRadius: td.buttonRadius,
  },
  idle: {
    backgroundColor: td.idleGrey,
    borderColor: td.idleGrey,
  },
  pressed: {
    backgroundColor: td.orangePressed,
    borderColor: td.orangePressed,
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
    fontWeight: '600',
    fontSize: 30,
    letterSpacing: 1,
  },
  status: {
    color: td.white,
    fontWeight: '700',
    fontSize: 15,
    marginTop: 2,
  },
})
