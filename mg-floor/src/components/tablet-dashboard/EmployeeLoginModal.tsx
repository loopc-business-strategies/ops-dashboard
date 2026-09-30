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
import { pinProblem } from './pinRules'

type Mode = 'pin' | 'password' | 'setpin' | 'done' | 'newpin'

type Props = {
  visible: boolean
  onClose: () => void
  /** Department the tablet is working for; operators from another department are refused. */
  tabletDepartment: string
}

/** Space the login button and links (plus sheet and backdrop padding) take below the scrolling fields. */
const FOOTER_HEIGHT = 150

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

function PinPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <View>
      <View style={styles.dots} accessibilityLabel={`PIN ${value.length} digits entered`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotOn, i >= 4 && value.length < 4 && styles.dotOptional]} />
        ))}
      </View>
      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === 'back' ? 'Delete digit' : k === 'clear' ? 'Clear PIN' : `Digit ${k}`}
            disabled={disabled}
            onPress={() => {
              if (k === 'back') onChange(value.slice(0, -1))
              else if (k === 'clear') onChange('')
              else if (value.length < 6) onChange(value + k)
            }}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={[styles.keyText, (k === 'back' || k === 'clear') && styles.keyTextSmall]}>
              {k === 'back' ? '⌫' : k === 'clear' ? 'Clear' : k}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export function EmployeeLoginModal({ visible, onClose, tabletDepartment }: Props) {
  const { login, loginWithPin, setMyPin } = useAuth()
  const [mode, setMode] = useState<Mode>('pin')
  const [employee, setEmployee] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
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
    setMode('pin')
    setEmployee('')
    setPin('')
    setPassword('')
    setNewPin('')
    setConfirmPin('')
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

  const afterLogin = async (session: FloorSession, cred: QuickLoginCredential | null, offerPin: boolean) => {
    lastCred.current = cred
    const enroll = Boolean(cred) && bioReady && !(await hasQuickLogin(session.user.id))
    if (!enroll && !(offerPin && !session.user.hasFloorPin)) {
      onClose()
      return
    }
    setJoined(session)
    setCanEnrollBio(enroll)
    setMode('done')
  }

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

  const submitPin = () =>
    run(async () => {
      const id = employee.trim()
      if (!id) throw new Error('Enter your Employee ID.')
      if (pin.length < 4) throw new Error('Enter your 4–6 digit PIN.')
      try {
        const session = await loginWithPin(id, pin, { validate })
        await afterLogin(session, { kind: 'pin', employee: id, pin }, false)
      } catch (err) {
        setPin('')
        throw err
      }
    })

  const submitPassword = () =>
    run(async () => {
      const id = employee.trim()
      if (!id || !password) throw new Error('Enter your username and password.')
      const session = await login(id, password, { validate })
      await afterLogin(session, { kind: 'password', name: id, password }, true)
    })

  const submitSetPin = () =>
    run(async () => {
      const id = employee.trim()
      if (!id || !password) throw new Error('Enter your username and password.')
      const problem = pinProblem(newPin, confirmPin)
      if (problem) throw new Error(problem)
      const session = await login(id, password, { validate })
      await setMyPin(session.user.id, password, newPin)
      await afterLogin({ ...session, user: { ...session.user, hasFloorPin: true } }, { kind: 'pin', employee: session.user.employeeCode || id, pin: newPin }, false)
    })

  const submitNewPinAfterLogin = () =>
    run(async () => {
      if (!joined || lastCred.current?.kind !== 'password') throw new Error('Log in with your password first.')
      const problem = pinProblem(newPin, confirmPin)
      if (problem) throw new Error(problem)
      await setMyPin(joined.user.id, lastCred.current.password, newPin)
      lastCred.current = { kind: 'pin', employee: joined.user.employeeCode || joined.user.name, pin: newPin }
      setJoined({ ...joined, user: { ...joined.user, hasFloorPin: true } })
      setNewPin('')
      setConfirmPin('')
      setNotice('PIN saved. Next time log in with your Employee ID and PIN.')
      setMode('done')
    })

  const quickLogin = (entry: QuickLoginEntry) =>
    run(async () => {
      const cred = await unlockQuickLogin(entry)
      if (!cred) throw new Error('Fingerprint / Face ID was cancelled.')
      try {
        const session = cred.kind === 'pin'
          ? await loginWithPin(cred.employee, cred.pin, { validate, method: 'biometric' })
          : await login(cred.name, cred.password, { validate, method: 'biometric' })
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
          throw new Error(`The saved fingerprint login for ${entry.name} no longer works (PIN or password changed). Log in with PIN or password and turn it on again.`)
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

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setPin('')
    setPassword('')
    setNewPin('')
    setConfirmPin('')
  }

  const title =
    mode === 'password' ? 'Login with password'
      : mode === 'setpin' ? 'Set / change my PIN'
        : mode === 'newpin' ? 'Create your PIN'
          : mode === 'done' ? `${joined?.user.name || 'Employee'} logged in`
            : 'Employee login'

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
            {mode === 'pin' && quick.length ? (
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
              </View>
            ) : null}

            {mode === 'pin' || mode === 'password' || mode === 'setpin' ? (
              <View style={styles.section}>
                <Text style={styles.label}>{mode === 'pin' ? 'Employee ID' : 'Username'}</Text>
                <TextInput
                  accessibilityLabel="Employee ID"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  value={employee}
                  onChangeText={setEmployee}
                  placeholder={mode === 'pin' ? 'e.g. MG-104' : 'Username'}
                  placeholderTextColor={td.textMuted}
                  editable={!busy}
                />
              </View>
            ) : null}

            {mode === 'pin' ? (
              <View style={styles.section}>
                <Text style={styles.label}>PIN</Text>
                <PinPad value={pin} onChange={setPin} disabled={busy} />
              </View>
            ) : null}

            {mode === 'password' || mode === 'setpin' ? (
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
                  onSubmitEditing={mode === 'password' ? submitPassword : undefined}
                />
              </View>
            ) : null}

            {mode === 'setpin' || mode === 'newpin' ? (
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>New PIN (4–6 digits)</Text>
                  <TextInput
                    accessibilityLabel="New PIN"
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.input}
                    value={newPin}
                    onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
                    editable={!busy}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Confirm PIN</Text>
                  <TextInput
                    accessibilityLabel="Confirm PIN"
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.input}
                    value={confirmPin}
                    onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                    editable={!busy}
                  />
                </View>
              </View>
            ) : null}

            {mode === 'done' && joined ? (
              <View style={styles.section}>
                <Text style={styles.doneText}>✓ {joined.user.name} is logged in on this tablet.</Text>
                {!joined.user.hasFloorPin && lastCred.current?.kind === 'password' ? (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode('newpin')} style={styles.offer}>
                    <Text style={styles.offerTitle}>Create a PIN for faster login</Text>
                    <Text style={styles.offerBody}>Next time: Employee ID + PIN instead of the password.</Text>
                  </Pressable>
                ) : null}
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
              onPress={mode === 'pin' ? submitPin : mode === 'password' ? submitPassword : mode === 'setpin' ? submitSetPin : submitNewPinAfterLogin}
              style={({ pressed }) => [styles.primary, buttonShadow, { opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              {busy ? <ActivityIndicator color={td.white} /> : (
                <Text style={styles.primaryText}>{mode === 'setpin' || mode === 'newpin' ? 'SAVE PIN' : 'LOGIN'}</Text>
              )}
            </Pressable>
          )}

          {mode === 'pin' || mode === 'password' || mode === 'setpin' ? (
            <View style={styles.links}>
              {mode !== 'pin' ? (
                <Pressable accessibilityRole="button" onPress={() => switchMode('pin')} disabled={busy}>
                  <Text style={styles.link}>Use PIN</Text>
                </Pressable>
              ) : null}
              {mode !== 'password' ? (
                <Pressable accessibilityRole="button" onPress={() => switchMode('password')} disabled={busy}>
                  <Text style={styles.link}>Use password instead</Text>
                </Pressable>
              ) : null}
              {mode !== 'setpin' ? (
                <Pressable accessibilityRole="button" onPress={() => switchMode('setpin')} disabled={busy}>
                  <Text style={styles.link}>Set / change my PIN</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
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
  row2: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex1: { flex: 1 },
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 6 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: td.orange },
  dotOn: { backgroundColor: td.orange },
  dotOptional: { borderStyle: 'dashed', opacity: 0.5 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 6 },
  key: {
    width: '31.5%',
    minHeight: 52,
    borderRadius: td.radius,
    borderWidth: 1,
    borderColor: td.borderLight,
    backgroundColor: td.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: td.cream, borderColor: td.orange },
  keyText: { color: td.text, fontWeight: '800', fontSize: 22 },
  keyTextSmall: { fontSize: 15, color: td.textMuted },
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
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 12 },
  link: { color: td.orange, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
})
