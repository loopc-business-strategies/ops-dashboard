import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  onLogin: () => void
  onLogout: () => void
  loggedIn: boolean
  loginDisabled?: boolean
}

/** Logout is hidden until logged in. */
export function LoginLogoutRow({ onLogin, onLogout, loggedIn, loginDisabled }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        disabled={loginDisabled || loggedIn}
        onPress={onLogin}
        style={({ pressed }) => [
          styles.btn,
          styles.login,
          loggedIn ? styles.btnHalf : styles.btnFull,
          { opacity: loginDisabled || loggedIn ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.loginText}>Login</Text>
      </Pressable>
      {loggedIn ? (
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.btn, styles.logout, styles.btnHalf, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: td.radius,
  },
  btnFull: { flex: 1 },
  btnHalf: { flex: 1 },
  login: {
    backgroundColor: td.orange,
    borderColor: td.orange,
  },
  logout: {
    backgroundColor: td.white,
    borderColor: td.orange,
  },
  loginText: {
    color: td.white,
    fontWeight: '800',
    fontSize: 18,
  },
  logoutText: {
    color: td.orange,
    fontWeight: '800',
    fontSize: 18,
  },
})
