import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  onLogin: () => void
  onLogout: () => void
  loginDisabled?: boolean
  logoutDisabled?: boolean
}

export function LoginLogoutRow({ onLogin, onLogout, loginDisabled, logoutDisabled }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        disabled={loginDisabled}
        onPress={onLogin}
        style={({ pressed }) => [
          styles.btn,
          styles.login,
          { opacity: loginDisabled ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.loginText}>Login</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={logoutDisabled}
        onPress={onLogout}
        style={({ pressed }) => [
          styles.btn,
          styles.logout,
          { opacity: logoutDisabled ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
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
    borderRadius: td.radius,
  },
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

