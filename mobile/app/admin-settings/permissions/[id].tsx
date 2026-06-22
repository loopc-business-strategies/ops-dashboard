import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { PermissionEditor } from '@/src/components/admin/PermissionEditor'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { fetchUsers, getUserId, updateUserPermissions } from '@/src/api/users'
import type { ModulePermissions } from '@/src/constants/admin'

export default function PermissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token } = useAuth()
  const sessionReady = useTenantSessionReady()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [perms, setPerms] = useState<ModulePermissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id || !sessionReady) return
    fetchUsers(token)
      .then((users) => {
        const user = users.find((u) => getUserId(u) === id)
        if (!user) throw new Error('User not found')
        if (user.role === 'super_admin') throw new Error('Super admin permissions cannot be edited here.')
        setUserName(user.fullName || user.name)
        setPerms(user.modulePermissions || {})
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load permissions'))
      .finally(() => setLoading(false))
  }, [token, id, sessionReady])

  const onSave = async () => {
    if (!token || !id || !sessionReady) return
    setSaving(true)
    setError('')
    try {
      await updateUserPermissions(token, id, perms)
      Alert.alert('Success', 'Permissions saved.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={mgBranding.colors.primary} />}
      </View>
    )
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Permissions for {userName}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PermissionEditor perms={perms} onChange={setPerms} />
      <Pressable style={[styles.btn, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save permissions</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  subtitle: { fontSize: 14, color: mgBranding.colors.muted },
  error: { color: mgBranding.colors.danger, fontSize: 14 },
  btn: {
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
