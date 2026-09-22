import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, FormPanel, Screen, Subtitle, Title } from '@/src/components/ui'
import { colors, spacing } from '@/src/theme'
import { userFacingMessage } from '@/src/api/errors'

export default function EmployeeLoginScreen() {
  const {
    department,
    loginEmployee,
    loginWithBiometric,
    logoutDepartment,
    biometricAvailable,
    biometricEnrolled,
  } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    setError('')
    setBusy(true)
    try {
      await loginEmployee(name, password)
      router.replace('/')
    } catch (err) {
      setError(userFacingMessage(err) || 'Employee login failed')
    } finally {
      setBusy(false)
    }
  }

  const onBiometric = async () => {
    setError('')
    setBusy(true)
    try {
      await loginWithBiometric()
      router.replace('/')
    } catch (err) {
      setError(userFacingMessage(err) || 'Face ID failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <FormPanel>
          <Title>EMPLOYEE LOGIN</Title>
          <Subtitle>
            {department ? `${department.label} department` : 'Department unlocked'} — password or Face ID
          </Subtitle>

          {biometricAvailable && biometricEnrolled ? (
            <View style={styles.bioWrap}>
              <BigButton
                label={busy ? 'AUTHENTICATING…' : 'USE FACE ID'}
                onPress={onBiometric}
                disabled={busy}
                tone="success"
              />
              <Text style={styles.or}>or password</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Employee</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Password</Text>
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
            label={busy ? 'SIGNING IN…' : 'SIGN IN'}
            onPress={onSubmit}
            disabled={busy || !name.trim() || !password}
          />
          <BigButton
            label="CHANGE DEPARTMENT"
            onPress={async () => {
              await logoutDepartment()
              router.replace('/department-login')
            }}
            tone="neutral"
            disabled={busy}
          />
        </FormPanel>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  bioWrap: { marginTop: spacing.xl, marginBottom: spacing.md },
  or: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, fontWeight: '600' },
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
