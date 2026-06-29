import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { UserForm } from '@/src/components/admin/UserForm'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import { createAdminFormScreenStyles } from '@/src/styles/adminFormScreenStyles'
import { createUser } from '@/src/api/users'
import { EMPTY_USER_FORM, type UserFormState } from '@/src/constants/admin'
import { formToPayload, validateUserForm } from '@/src/utils/userForm'

export default function CreateUserScreen() {
  const { token } = useAuth()
  const sessionReady = useTenantSessionReady()
  const router = useRouter()
  const styles = useBrandingStyles(createAdminFormScreenStyles)
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    const validationError = validateUserForm(form, false)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!token || !sessionReady) return
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
