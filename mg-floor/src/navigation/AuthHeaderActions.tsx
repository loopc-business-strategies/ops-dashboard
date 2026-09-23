import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { clearSelectedDepartment } from '@/src/auth/sessionPrefs'
import { colors, spacing } from '@/src/theme'

/** Phone header / tablet sidebar — Login when logged out, name+Logout when logged in. */
export function AuthHeaderActions() {
  const { token, user, logout } = useAuth()
  const router = useRouter()

  const onLogout = async () => {
    await logout()
    // Stay on Home; department gate remains.
  }

  const onSwitchDept = () => {
    Alert.alert('Switch department', 'Return to department selection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        style: 'destructive',
        onPress: async () => {
          await logout()
          await clearSelectedDepartment()
          router.replace('/department')
        },
      },
    ])
  }

  if (!token) {
    return (
      <View style={styles.row}>
        <Pressable onPress={onSwitchDept} hitSlop={8} style={styles.btn}>
          <Text style={styles.linkMuted}>DEPT</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/login')} hitSlop={8} style={styles.btn}>
          <Text style={styles.link}>Login</Text>
        </Pressable>
      </View>
    )
  }

  const identity = user?.name || user?.id || 'Employee'

  return (
    <View style={styles.row}>
      <Pressable onPress={onSwitchDept} hitSlop={8} style={styles.btn}>
        <Text style={styles.linkMuted} numberOfLines={1}>
          {identity}
        </Text>
      </Pressable>
      <Pressable onPress={onLogout} hitSlop={8} style={styles.btn}>
        <Text style={styles.link}>Logout</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.sm,
    maxWidth: 220,
  },
  btn: { paddingVertical: 6, paddingHorizontal: 4 },
  link: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  linkMuted: { color: colors.textMuted, fontWeight: '700', fontSize: 12, maxWidth: 120 },
})
