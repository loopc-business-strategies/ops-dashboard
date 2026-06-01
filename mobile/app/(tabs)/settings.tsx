import { Pressable, StyleSheet, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { mgBranding } from '@/src/config/branding'
import { TENANT } from '@/src/config/tenant'
import { useAuth } from '@/src/context/AuthContext'

export default function SettingsScreen() {
  const { user, logout } = useAuth()

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.name}>{user?.fullName || user?.name || 'User'}</Text>
        <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
        <Text style={styles.meta}>Tenant: {TENANT.toUpperCase()}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.meta}>MG Ops Mobile v{Constants.expoConfig?.version || '1.0.0'}</Text>
        <Text style={styles.meta}>View-only companion app</Text>
        <Text style={styles.meta}>Push notifications — coming soon</Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background, padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  label: { fontSize: 12, fontWeight: '700', color: mgBranding.colors.muted, textTransform: 'uppercase' },
  name: { marginTop: 6, fontSize: 20, fontWeight: '800', color: mgBranding.colors.text },
  meta: { marginTop: 4, fontSize: 14, color: mgBranding.colors.muted },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: mgBranding.colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
