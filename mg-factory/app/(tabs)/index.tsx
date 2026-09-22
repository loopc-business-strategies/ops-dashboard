import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, useIsTablet } from '@/src/components/ui'
import { callManager } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type OpDef = {
  label: string
  route?: '/metal-in' | '/metal-out' | '/alloy-in' | '/alloy-out' | '/purity' | '/batch-start' | '/batch-over'
  tone?: 'accent' | 'danger' | 'neutral' | 'success'
  alert?: boolean
}

const OPS: OpDef[] = [
  { label: 'METAL IN', route: '/metal-in', tone: 'success' },
  { label: 'METAL OUT', route: '/metal-out' },
  { label: 'ALLOY IN', route: '/alloy-in', tone: 'success' },
  { label: 'ALLOY OUT', route: '/alloy-out' },
  { label: 'PURITY', route: '/purity' },
  { label: 'BATCH START', route: '/batch-start' },
  { label: 'BATCH OVER', route: '/batch-over' },
  { label: 'ALERT', alert: true, tone: 'danger' },
]

export default function HomeScreen() {
  const {
    department,
    user,
    employeeToken,
    loginEmployee,
    loginWithBiometric,
    logoutEmployee,
    logoutDepartment,
    biometricAvailable,
    biometricEnrolled,
  } = useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const [calling, setCalling] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [empName, setEmpName] = useState('')
  const [empPassword, setEmpPassword] = useState('')
  const [signBusy, setSignBusy] = useState(false)
  const [signError, setSignError] = useState('')

  const signedIn = Boolean(employeeToken && user?.name)

  const closeLoginModal = () => {
    setLoginOpen(false)
    setSignError('')
    setEmpPassword('')
  }

  const onSignIn = async () => {
    setSignError('')
    setSignBusy(true)
    try {
      await loginEmployee(empName, empPassword)
      setEmpPassword('')
      setLoginOpen(false)
    } catch (err) {
      setSignError(userFacingMessage(err) || 'Sign in failed')
    } finally {
      setSignBusy(false)
    }
  }

  const onFaceId = async () => {
    setSignError('')
    setSignBusy(true)
    try {
      await loginWithBiometric()
      setLoginOpen(false)
    } catch (err) {
      setSignError(userFacingMessage(err) || 'Face ID failed')
    } finally {
      setSignBusy(false)
    }
  }

  const onHeaderAuthPress = async () => {
    if (signedIn) {
      await logoutEmployee()
      return
    }
    setSignError('')
    setLoginOpen(true)
  }

  const onChangeDepartment = async () => {
    await logoutDepartment()
    router.replace('/department-login')
  }

  const onCallManager = async () => {
    if (!employeeToken) {
      Alert.alert('Sign in required', 'Tap Login (top right) first')
      return
    }
    setCalling(true)
    try {
      const res = await callManager(employeeToken, {
        message: `${user?.name || 'Operator'} needs assistance in ${department?.label || 'department'}`,
      })
      Alert.alert('Floor manager alerted', res.alert?.alertNumber ? `Alert ${res.alert.alertNumber}` : 'Sent')
    } catch (err) {
      Alert.alert('Call failed', userFacingMessage(err))
    } finally {
      setCalling(false)
    }
  }

  const onOp = (op: OpDef) => {
    if (!signedIn) {
      Alert.alert('Sign in required', 'Tap Login (top right) first')
      return
    }
    if (op.alert) {
      onCallManager()
      return
    }
    if (op.route) router.push(op.route)
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>MG FACTORY</Text>
            <Text style={styles.subtitle}>
              {department?.label || 'Department'} floor hub
              {signedIn ? ` · ${user?.name}` : ''}
            </Text>
            <Pressable onPress={onChangeDepartment} hitSlop={8}>
              <Text style={styles.deptLink}>Change department</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={signedIn ? 'Logout' : 'Login'}
            onPress={onHeaderAuthPress}
            style={({ pressed }) => [styles.authBtn, pressed && styles.authBtnPressed]}
          >
            {!signedIn ? (
              <MaterialCommunityIcons name="fingerprint" size={18} color={colors.accent} />
            ) : null}
            <Text style={styles.authBtnText}>{signedIn ? 'Logout' : 'Login'}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>OPERATIONS</Text>
        <View style={[styles.grid, tablet && styles.gridTablet]}>
          {OPS.map((op) => (
            <View key={op.label} style={[styles.gridItem, tablet && styles.gridItemTablet]}>
              <BigButton
                label={op.alert && calling ? 'CALLING…' : op.label}
                tone={op.tone || 'accent'}
                onPress={() => onOp(op)}
                disabled={op.alert ? calling : false}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={loginOpen}
        transparent
        animationType="fade"
        onRequestClose={closeLoginModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeLoginModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Employee login</Text>
            <Text style={styles.modalHint}>Required to confirm Metal / Alloy / Batch actions</Text>
            <Text style={styles.label}>Employee</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              value={empName}
              onChangeText={setEmpName}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              secureTextEntry
              style={styles.input}
              value={empPassword}
              onChangeText={setEmpPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
            />
            {signError ? <Text style={styles.error}>{signError}</Text> : null}
            {biometricAvailable && biometricEnrolled ? (
              <BigButton
                label={signBusy ? '…' : 'FACE ID'}
                tone="success"
                onPress={onFaceId}
                disabled={signBusy}
              />
            ) : null}
            <BigButton
              label={signBusy ? 'SIGNING IN…' : 'SIGN IN'}
              onPress={onSignIn}
              disabled={signBusy || !empName.trim() || !empPassword}
            />
            <BigButton label="CANCEL" tone="neutral" onPress={closeLoginModal} disabled={signBusy} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.md },
  scroll: { paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  deptLink: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: spacing.sm,
    fontSize: 14,
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  authBtnPressed: { opacity: 0.75 },
  authBtnText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    color: colors.text,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  grid: { gap: spacing.sm },
  gridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '100%' },
  gridItemTablet: { width: '48%', flexGrow: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  modalHint: { color: colors.textMuted, marginBottom: spacing.sm },
  label: { color: colors.textMuted, marginBottom: 4, marginTop: spacing.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: colors.danger, fontWeight: '600' },
})
