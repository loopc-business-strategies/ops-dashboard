import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useAuth, type FloorSession } from '@/src/context/AuthContext'
import { toApiError } from '@/src/api/errors'
import { biometricAvailable } from '@/src/auth/sessionPrefs'
import {
  LEGACY_QUICK_ID,
  hasQuickLogin,
  listQuickLogins,
  removeQuickLogin,
  saveQuickLogin,
  unlockQuickLogin,
  type QuickLoginCredential,
  type QuickLoginEntry,
} from '@/src/auth/quickLogin'
import { departmentMismatch } from '@/src/auth/sessionList'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'

type Mode = 'password' | 'done'

type Props = {
  visible: boolean
  onClose: () => void
  /** Department the tablet is working for; operators from another department are refused. */
  tabletDepartment: string
}

/** Space the login button (plus sheet and backdrop padding) takes below the scrolling fields. */
const FOOTER_HEIGHT = 120

/** Employees join the tablet with Employee ID + password, or fingerprint / Face ID once turned on. */
export function EmployeeLoginModal({ visible, onClose, tabletDepartment }: Props) {
  const { login } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [employee, setEmployee] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [quick, setQuick] = useState<QuickLoginEntry[]>([])
  const [bioReady, setBioReady] = useState(false)
  const [joined, setJoined] = useState<FloorSession | null>(null)
  const [canEnrollBio, setCanEnrollBio] = useState(false)
  /** The login just used, kept only while this popup is open so the employee can save it for fingerprint. */
  const lastCred = useRef<QuickLoginCredential | null>(null)

  const reset = () => {
    setMode('password')
    setEmployee('')
    setPassword('')
    setError(null)
    setNotice(null)
    setJoined(null)
    setCanEnrollBio(false)
    lastCred.current = null
  }

  useEffect(() => {
    reset()
    if (!visible) return
    let cancelled = false
    ;(async () => {
      const [avail, list] = await Promise.all([biometricAvailable(), listQuickLogins()])
      if (cancelled) return
      setBioReady(avail)
      setQuick(list)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [visible])

  const close = () => {
    if (busy) return
    lastCred.current = null
    onClose()
  }

  const validate = (s: FloorSession) => departmentMismatch(s, tabletDepartment)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError(toApiError(err).message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = () =>
    run(async () => {
      const id = employee.trim()
      if (!id || !password) throw new Error('Enter your Employee ID and password.')
      const session = await login(id, password, { validate })
      const cred: QuickLoginCredential = { kind: 'password', name: id, password }
      if (!bioReady || (await hasQuickLogin(session.user.id))) {
        onClose()
        return
      }
      lastCred.current = cred
      setJoined(session)
      setCanEnrollBio(true)
      setMode('done')
    })

  const quickLogin = (entry: QuickLoginEntry) =>
    run(async () => {
      const cred = await unlockQuickLogin(entry)
      if (!cred) throw new Error('Fingerprint / Face ID was cancelled.')
      try {
        const session = await login(cred.name, cred.password, { validate, method: 'biometric' })
        if (entry.id === LEGACY_QUICK_ID) {
          await saveQuickLogin({ id: session.user.id, name: session.user.name, employeeCode: session.user.employeeCode }, cred)
          await removeQuickLogin(LEGACY_QUICK_ID)
        }
        onClose()
      } catch (err) {
        const e = toApiError(err)
        if (e.kind === 'AUTH_ERROR') {
          await removeQuickLogin(entry.id)
          setQuick((list) => list.filter((q) => q.id !== entry.id))
          throw new Error(`The saved fingerprint login for ${entry.name} no longer works (password changed). Log in with your password and turn it on again.`)
        }
        throw err
      }
    })

  const enrollBio = () =>
    run(async () => {
      if (!joined || !lastCred.current) return
      const ok = await saveQuickLogin(
        { id: joined.user.id, name: joined.user.name, employeeCode: joined.user.employeeCode },
        lastCred.current,
      )
      if (!ok) throw new Error('Could not save fingerprint login on this tablet.')
      setCanEnrollBio(false)
      setNotice(`Fingerprint / Face ID is on for ${joined.user.name}.`)
    })

  const title = mode === 'done' ? `${joined?.user.name || 'Employee'} logged in` : 'Employee login'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.titleBar}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close login" hitSlop={10} onPress={close}>
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            bottomOffset={FOOTER_HEIGHT}
            contentContainerStyle={styles.content}
          >
            {mode === 'password' && quick.length ? (
              <View style={styles.section}>
                <Text style={styles.label}>Fingerprint / Face ID</Text>
                <View style={styles.chips}>
                  {quick.map((q) => (
                    <Pressable
                      key={q.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Fingerprint login ${q.name}`}
                      disabled={busy}
                      onPress={() => quickLogin(q)}
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <Text style={styles.chipText}>☝ {q.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.or}>or log in with your password</Text>
              </View>
            ) : null}

            {mode === 'password' ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>Employee ID</Text>
                  <TextInput
                    accessibilityLabel="Employee ID"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    value={employee}
                    onChangeText={setEmployee}
                    placeholder="Username"
                    placeholderTextColor={td.textMuted}
                    editable={!busy}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.section}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    accessibilityLabel="Password"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={td.textMuted}
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={submitPassword}
                  />
                </View>
              </>
            ) : null}

            {mode === 'done' && joined ? (
              <View style={styles.section}>
                <Text style={styles.doneText}>✓ {joined.user.name} is logged in on this tablet.</Text>
                {canEnrollBio ? (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={enrollBio} style={styles.offer}>
                    <Text style={styles.offerTitle}>Turn on fingerprint / Face ID for {joined.user.name}</Text>
                    <Text style={styles.offerBody}>
                      Any fingerprint or face saved on this tablet will be able to log in as {joined.user.name}.
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </KeyboardAwareScrollView>

          {mode === 'done' ? (
            <Pressable accessibilityRole="button" onPress={close} style={[styles.primary, buttonShadow]}>
              <Text style={styles.primaryText}>DONE</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submitPassword}
              style={({ pressed }) => [styles.primary, buttonShadow, { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              {busy ? <ActivityIndicator color={td.white} /> : <Text style={styles.primaryText}>LOGIN</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '94%',
    flexShrink: 1,
    backgroundColor: td.white,
    borderRadius: td.radius,
    borderWidth: 1,
    borderColor: td.border,
    padding: 16,
    zIndex: 1,
  },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: td.text, fontWeight: '800', fontSize: 20, flex: 1 },
  closeX: { color: td.textMuted, fontWeight: '800', fontSize: 18, paddingHorizontal: 4 },
  content: { paddingBottom: 4 },
  section: { marginTop: 8 },
  label: { color: td.textMuted, fontWeight: '600', marginBottom: 6 },
  or: { color: td.textMuted, fontSize: 13, textAlign: 'center', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: td.borderLight,
    borderRadius: td.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
    color: td.text,
    fontWeight: '700',
    fontSize: 17,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: td.orange,
    backgroundColor: td.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: { backgroundColor: td.cream },
  chipText: { color: td.orange, fontWeight: '700', fontSize: 15 },
  doneText: { color: '#15803D', fontWeight: '800', fontSize: 16, marginBottom: 6 },
  offer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: td.orange,
    borderRadius: td.radius,
    backgroundColor: td.cream,
    padding: 12,
  },
  offerTitle: { color: td.orange, fontWeight: '800', fontSize: 15 },
  offerBody: { color: td.textMuted, fontSize: 13, marginTop: 2 },
  notice: { color: '#15803D', fontSize: 14, fontWeight: '600', marginTop: 10 },
  error: { color: '#B91C1C', fontSize: 14, fontWeight: '600', marginTop: 10 },
  primary: {
    backgroundColor: td.orange,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: td.radius,
    marginTop: 12,
  },
  primaryText: { color: td.white, fontWeight: '800', fontSize: 17, letterSpacing: 0.4 },
})
