import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { ModernGoldLogo } from '@/src/components/ModernGoldLogo'
import { colors, spacing, brand } from '@/src/theme'
import { MG_TENANT } from '@/src/config/tenant'
import {
  authenticateWithBiometric,
  biometricAvailable,
  enrollBiometricCredentials,
  getSelectedDepartment,
  isBiometricEnabled,
} from '@/src/auth/sessionPrefs'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dept, setDept] = useState<string | null>(null)
  const [bioReady, setBioReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const d = await getSelectedDepartment()
      if (!d) {
        router.replace('/department')
        return
      }
      setDept(d)
      const avail = await biometricAvailable()
      const enabled = await isBiometricEnabled()
      setBioReady(avail && enabled)
    })()
  }, [router])

  const finishLogin = async (username: string, pwd: string) => {
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), pwd)
      const avail = await biometricAvailable()
      if (avail) {
        Alert.alert('Biometric sign-in', 'Enable fingerprint / Face ID for next login?', [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              enrollBiometricCredentials(username.trim(), pwd).catch(() => {})
            },
          },
        ])
      }
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = () => finishLogin(name, password)

  const onBiometric = async () => {
    setError('')
    setBusy(true)
    try {
      const creds = await authenticateWithBiometric()
      if (!creds) {
        setError('Biometric authentication cancelled or unavailable')
        return
      }
      await login(creds.username, creds.password)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <ModernGoldLogo height={72} />
        <Title>{brand.appName}</Title>
        <Subtitle>Employee Login</Subtitle>
        <View style={styles.lock}>
          <Text style={styles.lockText}>
            {dept ? `DEPT: ${dept.toUpperCase()}` : 'SELECT DEPARTMENT'} · TENANT {MG_TENANT.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.label}>Employee ID</Text>
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
          label={busy ? 'SIGNING IN…' : 'LOGIN'}
          onPress={onSubmit}
          disabled={busy || !name || !password}
        />
        {bioReady ? (
          <BigButton
            label="USE FINGERPRINT / FACE ID"
            onPress={onBiometric}
            tone="neutral"
            disabled={busy}
          />
        ) : null}
        <BigButton
          label="BACK TO APP"
          onPress={() => router.replace('/')}
          tone="neutral"
          disabled={busy}
        />
        <BigButton
          label="CHANGE DEPARTMENT"
          onPress={() => router.replace('/department')}
          tone="neutral"
          disabled={busy}
        />
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  lock: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  lockText: {
    color: colors.accent,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontSize: 12,
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
