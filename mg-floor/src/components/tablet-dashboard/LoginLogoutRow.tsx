import React from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'
import { usePulse } from './IdleFade'

type Props = {
  onLogin: () => void
  onLogout: () => void
  /** Employees logged in on this tablet; Login stays available so more can join. */
  loggedInCount: number
  loginDisabled?: boolean
}

/** Logout is hidden until someone is logged in; with several employees it logs out everyone. */
export function LoginLogoutRow({ onLogin, onLogout, loggedInCount, loginDisabled }: Props) {
  const loginOff = Boolean(loginDisabled)
  const loggedIn = loggedInCount > 0
  const scale = usePulse(!loggedIn && !loginOff)
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.loginWrap, { transform: [{ scale }] }]}>
        <Pressable
          accessibilityRole="button"
          disabled={loginOff}
          onPress={onLogin}
          style={({ pressed }) => [
            styles.btn,
            styles.login,
            !loginOff && buttonShadow,
            pressed && styles.loginPressed,
            loginOff && styles.off,
          ]}
        >
          <Text style={[styles.text, styles.loginText]}>Login</Text>
        </Pressable>
      </Animated.View>
      {loggedIn ? (
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.btn, styles.logout, styles.flex1, pressed && styles.outlinePressed]}
        >
          <Text style={[styles.text, styles.logoutText]}>{loggedInCount > 1 ? 'Logout all' : 'Logout'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  loginWrap: { flex: 1 },
  flex1: { flex: 1 },
  btn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: td.buttonRadius,
  },
  login: {
    backgroundColor: td.orange,
    borderColor: td.orange,
  },
  loginPressed: {
    backgroundColor: td.orangePressed,
    borderColor: td.orangePressed,
    transform: [{ scale: 0.98 }],
  },
  logout: {
    backgroundColor: td.white,
    borderColor: td.orange,
  },
  outlinePressed: {
    backgroundColor: td.cream,
    transform: [{ scale: 0.98 }],
  },
  off: { opacity: 0.45 },
  text: {
    fontFamily: td.buttonFont,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  loginText: { color: td.white },
  logoutText: { color: td.orange },
})
