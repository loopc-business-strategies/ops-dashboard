import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { clearSelectedDepartment } from '@/src/auth/sessionPrefs'
import { colors, spacing } from '@/src/theme'

export function AuthHeaderActions() {
  const { token, logout } = useAuth()
  const router = useRouter()

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

  return (
    <View style={styles.row}>
      <Pressable onPress={onSwitchDept} hitSlop={8} style={styles.btn}>
        <Text style={styles.linkMuted}>DEPT</Text>
      </Pressable>
      {token ? (
        <Pressable onPress={() => logout()} hitSlop={8} style={styles.btn}>
          <Text style={styles.link}>Logout</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/login')} hitSlop={8} style={styles.btn}>
          <Text style={styles.link}>Login</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginRight: spacing.sm },
  btn: { paddingVertical: 6, paddingHorizontal: 4 },
  link: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  linkMuted: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
})
