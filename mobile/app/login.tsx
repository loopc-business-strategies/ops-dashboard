import { useState } from 'react'
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
import { mgBranding } from '@/src/config/branding'
import { useAuth } from '@/src/context/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await login(name, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoTextPrimary}>Nexa</Text>
            <Text style={styles.logoTextSecondary}>MG</Text>
          </View>
          <Text style={styles.title}>{mgBranding.appName}</Text>
          <Text style={styles.company}>{mgBranding.companyName}</Text>
          <Text style={styles.tagline}>{mgBranding.tagline}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={loading || !name || !password}
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
  root: { flex: 1, backgroundColor: mgBranding.colors.primary },
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
  label: { fontSize: 13, fontWeight: '600', color: mgBranding.colors.text, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: mgBranding.colors.text,
  },
  error: { color: mgBranding.colors.danger, fontSize: 13, marginTop: 6 },
  button: {
    marginTop: 12,
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
