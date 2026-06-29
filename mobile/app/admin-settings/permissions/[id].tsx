import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { PermissionEditor } from '@/src/components/admin/PermissionEditor'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import { createAdminFormScreenStyles } from '@/src/styles/adminFormScreenStyles'
import { fetchUsers, getUserId, updateUserPermissions } from '@/src/api/users'
import type { ModulePermissions } from '@/src/constants/admin'

export default function PermissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token } = useAuth()
  const { branding } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const router = useRouter()
  const styles = useBrandingStyles(createAdminFormScreenStyles)
  const [userName, setUserName] = useState('')
  const [perms, setPerms] = useState<ModulePermissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id || !sessionReady) return
    setLoading(true)
    setError('')
    setUserName('')
    setPerms({})
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
  }, [token, id, sessionReady, tenantSessionKey])

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
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={branding.colors.primary} />}
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
