import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'

type Props = {
  onLogin: () => void
  onLogout: () => void
  loggedIn: boolean
  loginDisabled?: boolean
}

/** Logout is hidden until logged in. */
export function LoginLogoutRow({ onLogin, onLogout, loggedIn, loginDisabled }: Props) {
  const loginOff = loginDisabled || loggedIn
  return (
    <View style={styles.row}>
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
      {loggedIn ? (
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.btn, styles.logout, pressed && styles.outlinePressed]}
        >
          <Text style={[styles.text, styles.logoutText]}>Logout</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    minHeight: 54,
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
    fontSize: 18,
    letterSpacing: 0.6,
  },
  loginText: { color: td.white },
  logoutText: { color: td.orange },
})
