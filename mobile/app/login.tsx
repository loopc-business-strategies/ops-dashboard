import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useAuth } from '@/src/context/AuthContext'
import { getTenantBranding, normalizeTenantKey } from '@/src/config/tenantBranding'

export default function LoginScreen() {
  const { login } = useAuth()
  const { applyCompanyCode } = useTenantBranding()
  const [companyCode, setCompanyCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const previewBranding = useMemo(() => {
    const key = normalizeTenantKey(companyCode)
    return key ? getTenantBranding(key) : getTenantBranding('mg')
  }, [companyCode])

  const onSubmit = async () => {
    setError('')
    const code = companyCode.trim().toLowerCase()
    if (!normalizeTenantKey(code)) {
      setError('Enter a valid company code (e.g. mg, cg, loopc).')
      return
    }
    setLoading(true)
    try {
      await applyCompanyCode(code)
      await login(name, password, code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setError('')
  }, [companyCode])

  const colors = previewBranding.colors

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoTextPrimary}>{previewBranding.appName}</Text>
            <Text style={styles.logoTextSecondary}>{previewBranding.logoText}</Text>
          </View>
          <Text style={styles.title}>{previewBranding.appName}</Text>
          {previewBranding.companyName ? (
            <Text style={styles.company}>{previewBranding.companyName}</Text>
          ) : null}
          <Text style={styles.tagline}>{previewBranding.tagline}</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Company code</Text>
          <TextInput
            value={companyCode}
            onChangeText={setCompanyCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. mg, cg, loopc"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: colors.text }]}
          />
          <Text style={[styles.label, { color: colors.text }]}>Username</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: colors.text }]}
          />
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: colors.text }]}
          />
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={loading || !companyCode || !name || !password}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoTextPrimary: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  logoTextSecondary: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700', marginTop: 2 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  company: { color: 'rgba(255,255,255,0.92)', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  tagline: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 8 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { fontSize: 13, marginTop: 6 },
  button: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
