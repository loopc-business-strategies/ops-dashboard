import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, FormPanel, Screen, Subtitle, Title } from '@/src/components/ui'
import { colors, spacing } from '@/src/theme'
import { MG_TENANT } from '@/src/config/tenant'
import { userFacingMessage } from '@/src/api/errors'

export default function DepartmentLoginScreen() {
  const { unlockDepartment } = useAuth()
  const router = useRouter()
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    setError('')
    setBusy(true)
    try {
      await unlockDepartment(department, password)
      router.replace('/employee-login')
    } catch (err) {
      setError(userFacingMessage(err) || 'Department login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <FormPanel>
          <Title>MG FACTORY</Title>
          <Subtitle>Modern Gold — department unlock</Subtitle>
          <View style={styles.lock}>
            <Text style={styles.lockText}>TENANT LOCKED: {MG_TENANT.toUpperCase()}</Text>
          </View>

          <Text style={styles.label}>Department</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. melting"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Department password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <BigButton
            label={busy ? 'UNLOCKING…' : 'UNLOCK DEPARTMENT'}
            onPress={onSubmit}
            disabled={busy || !department.trim() || !password}
          />
        </FormPanel>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  lock: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  lockText: { color: colors.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.8 },
  label: { color: colors.textMuted, marginBottom: 6, marginTop: spacing.md, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontWeight: '600' },
})
