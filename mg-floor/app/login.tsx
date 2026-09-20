import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { colors, spacing } from '@/src/theme'
import { MG_TENANT } from '@/src/config/tenant'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    setError('')
    setBusy(true)
    try {
      await login(name.trim(), password)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <Title>MG FLOOR</Title>
        <Subtitle>Modern Gold — factory production</Subtitle>
        <View style={styles.lock}>
          <Text style={styles.lockText}>TENANT LOCKED: {MG_TENANT.toUpperCase()}</Text>
        </View>

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
        <BigButton label={busy ? 'SIGNING IN…' : 'SIGN IN'} onPress={onSubmit} disabled={busy || !name || !password} />
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  lock: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  lockText: {
    color: colors.accent,
    fontWeight: '800',
    letterSpacing: 1,
  },
  label: {
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    fontWeight: '600',
  },
})
