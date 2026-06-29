import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  APP_NAME,
  getLoginPreviewBranding,
  LOGIN_NEUTRAL_COLORS,
  normalizeTenantKey,
} from '@/src/config/tenantBranding'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useAuth } from '@/src/context/AuthContext'
import {
  clearSavedLoginCredentials,
  loadSavedLoginCredentials,
  saveLoginCredentials,
} from '@/src/services/savedLoginCredentials'

export default function LoginScreen() {
  const { login } = useAuth()
  const { applyCompanyCode } = useTenantBranding()
  const [companyCode, setCompanyCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [rememberCredentials, setRememberCredentials] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const previewBranding = useMemo(() => getLoginPreviewBranding(companyCode), [companyCode])

  const accent = previewBranding?.colors ?? {
    primary: LOGIN_NEUTRAL_COLORS.primary,
    secondary: LOGIN_NEUTRAL_COLORS.secondary,
    text: LOGIN_NEUTRAL_COLORS.text,
    danger: LOGIN_NEUTRAL_COLORS.danger,
  }

  useEffect(() => {
    void loadSavedLoginCredentials()
      .then((saved) => {
        if (saved.remember) {
          setRememberCredentials(true)
          if (saved.companyCode) setCompanyCode(saved.companyCode)
          if (saved.name) setName(saved.name)
        }
      })
      .finally(() => setPrefsLoaded(true))
  }, [])

  const onSubmit = async () => {
    setError('')
    const code = companyCode.trim().toLowerCase()
    if (!normalizeTenantKey(code)) {
      setError('Enter a valid company code.')
      return
    }
    setLoading(true)
    try {
      await applyCompanyCode(code)
      await login(name, password, code)
      if (rememberCredentials) {
        await saveLoginCredentials({ companyCode: code, name })
      } else {
        await clearSavedLoginCredentials()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setError('')
  }, [companyCode])

  if (!prefsLoaded) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: accent.primary }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  const badgeLabel = previewBranding?.logoText || APP_NAME

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: accent.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoTextPrimary}>{badgeLabel}</Text>
          </View>
          <Text style={styles.title}>{APP_NAME}</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: accent.text }]}>Company code</Text>
          <TextInput
            value={companyCode}
            onChangeText={setCompanyCode}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            placeholder="Company code"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: accent.text }]}
          />
          <Text style={[styles.label, { color: accent.text }]}>Username</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: accent.text }]}
          />
          <Text style={[styles.label, { color: accent.text }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { color: accent.text }]}
          />
          <View style={styles.rememberRow}>
            <Switch
              value={rememberCredentials}
              onValueChange={setRememberCredentials}
              trackColor={{ false: '#D1D5DB', true: accent.secondary }}
              thumbColor="#FFFFFF"
            />
            <Text style={[styles.rememberLabel, { color: accent.text }]}>Remember company and username</Text>
          </View>
          {error ? <Text style={[styles.error, { color: accent.danger }]}>{error}</Text> : null}
          <Pressable
            style={[styles.button, { backgroundColor: accent.primary }, loading && { opacity: 0.7 }]}
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
  centered: { alignItems: 'center', justifyContent: 'center' },
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
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  rememberLabel: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 13, marginTop: 6 },
  button: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
