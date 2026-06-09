import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { mgBranding } from '@/src/config/branding'
import { TENANT } from '@/src/config/tenant'
import { useAuth } from '@/src/context/AuthContext'
import { isSuperAdmin } from '@/src/utils/roles'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const showAdmin = isSuperAdmin(user)

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.name}>{user?.fullName || user?.name || 'User'}</Text>
        <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
        <Text style={styles.meta}>Tenant: {TENANT.toUpperCase()}</Text>
      </View>

      {showAdmin ? (
        <Pressable style={styles.adminCard} onPress={() => router.push('/admin-settings')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminTitle}>Admin settings</Text>
            <Text style={styles.adminDesc}>Manage users & permissions</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.meta}>MG Ops Mobile v{Constants.expoConfig?.version || '1.0.0'}</Text>
        <Text style={styles.meta}>View-only companion app</Text>
        <Text style={styles.meta}>
          Push: enabled after you allow notifications; the server must have EXPO_ACCESS_TOKEN (Expo) to
          deliver alerts when the app is in the background.
        </Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  adminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mgBranding.colors.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminTitle: { fontSize: 16, fontWeight: '800', color: mgBranding.colors.text },
  adminDesc: { fontSize: 13, color: mgBranding.colors.muted, marginTop: 4 },
  chevron: { fontSize: 28, color: mgBranding.colors.primary, fontWeight: '300' },
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
