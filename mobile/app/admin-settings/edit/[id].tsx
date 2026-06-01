import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { UserForm } from '@/src/components/admin/UserForm'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { fetchUsers, getUserId, updateUser } from '@/src/api/users'
import type { UserFormState } from '@/src/constants/admin'
import { formToPayload, userToForm, validateUserForm } from '@/src/utils/userForm'

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<UserFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id) return
    fetchUsers(token)
      .then((users) => {
        const user = users.find((u) => getUserId(u) === id)
        if (!user) throw new Error('User not found')
        setForm(userToForm(user))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user'))
      .finally(() => setLoading(false))
  }, [token, id])

  const onSave = async () => {
    if (!form || !token || !id) return
    const validationError = validateUserForm(form, true)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateUser(token, id, formToPayload(form, true))
      Alert.alert('Success', 'User updated.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={mgBranding.colors.primary} />}
      </View>
    )
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <UserForm form={form} setForm={(updater) => setForm((prev) => (prev ? (typeof updater === 'function' ? updater(prev) : updater) : prev))} isEdit />
      <Pressable style={[styles.btn, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
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
