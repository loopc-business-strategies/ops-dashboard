import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { UserForm } from '@/src/components/admin/UserForm'
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'
import { createUser } from '@/src/api/users'
import { EMPTY_USER_FORM, type UserFormState } from '@/src/constants/admin'
import { formToPayload, validateUserForm } from '@/src/utils/userForm'

export default function CreateUserScreen() {
  const { token } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    const validationError = validateUserForm(form, false)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!token) return
    setLoading(true)
    setError('')
    try {
      await createUser(token, formToPayload(form, false))
      Alert.alert('Success', 'User created.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <UserForm form={form} setForm={setForm} />
      <Pressable style={[styles.btn, loading && { opacity: 0.7 }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create user</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
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
