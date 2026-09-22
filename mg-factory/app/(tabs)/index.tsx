import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title, useIsTablet } from '@/src/components/ui'
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
    enrollBiometric,
    biometricAvailable,
    biometricEnrolled,
  } = useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const [calling, setCalling] = useState(false)
  const [empName, setEmpName] = useState('')
  const [empPassword, setEmpPassword] = useState('')
  const [signBusy, setSignBusy] = useState(false)
  const [signError, setSignError] = useState('')

  const signedIn = Boolean(employeeToken && user?.name)

  const onSignIn = async () => {
    setSignError('')
    setSignBusy(true)
    try {
      await loginEmployee(empName, empPassword)
      setEmpPassword('')
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
    } catch (err) {
      setSignError(userFacingMessage(err) || 'Face ID failed')
    } finally {
      setSignBusy(false)
    }
  }

  const onCallManager = async () => {
    if (!employeeToken) {
      Alert.alert('Sign in required', 'Sign in as employee before sending an alert')
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
      Alert.alert('Sign in required', 'Sign in as employee at the top of this screen first')
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
        <Title>MG FACTORY</Title>
        <Subtitle>{department?.label || 'Department'} floor hub</Subtitle>

        <View style={styles.empPanel}>
          <Text style={styles.empTitle}>EMPLOYEE</Text>
          {signedIn ? (
            <View style={styles.empSigned}>
              <Text style={styles.empName}>Operator: {user?.name}</Text>
              <View style={[styles.empActions, tablet && styles.empActionsRow]}>
                {biometricAvailable ? (
                  <View style={tablet ? styles.empCol : undefined}>
                    <BigButton
                      label="ENABLE FACE ID"
                      tone="neutral"
                      onPress={async () => {
                        try {
                          await enrollBiometric()
                          Alert.alert('Face ID enabled', 'Use Face ID next time from this screen.')
                        } catch (err) {
                          Alert.alert('Face ID', userFacingMessage(err))
                        }
                      }}
                    />
                  </View>
                ) : null}
                <View style={tablet ? styles.empCol : undefined}>
                  <BigButton
                    label="EMPLOYEE LOGOUT"
                    tone="neutral"
                    onPress={async () => {
                      await logoutEmployee()
                    }}
                  />
                </View>
                <View style={tablet ? styles.empCol : undefined}>
                  <BigButton
                    label="CHANGE DEPARTMENT"
                    tone="neutral"
                    onPress={async () => {
                      await logoutDepartment()
                      router.replace('/department-login')
                    }}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.hint}>Sign in to confirm Metal / Alloy / Batch actions</Text>
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
              <View style={[styles.empActions, tablet && styles.empActionsRow]}>
                {biometricAvailable && biometricEnrolled ? (
                  <View style={tablet ? styles.empCol : undefined}>
                    <BigButton
                      label={signBusy ? '…' : 'FACE ID'}
                      tone="success"
                      onPress={onFaceId}
                      disabled={signBusy}
                    />
                  </View>
                ) : null}
                <View style={tablet ? styles.empCol : undefined}>
                  <BigButton
                    label={signBusy ? 'SIGNING IN…' : 'SIGN IN'}
                    onPress={onSignIn}
                    disabled={signBusy || !empName.trim() || !empPassword}
                  />
                </View>
                <View style={tablet ? styles.empCol : undefined}>
                  <BigButton
                    label="CHANGE DEPARTMENT"
                    tone="neutral"
                    onPress={async () => {
                      await logoutDepartment()
                      router.replace('/department-login')
                    }}
                  />
                </View>
              </View>
            </View>
          )}
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
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.md },
  scroll: { paddingBottom: spacing.xl },
  empPanel: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  empTitle: { color: colors.accent, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm },
  empSigned: { gap: spacing.sm },
  empName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hint: { color: colors.textMuted, marginBottom: spacing.sm },
  label: { color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm, fontWeight: '600' },
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
  error: { color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },
  empActions: { marginTop: spacing.md, gap: spacing.sm },
  empActionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  empCol: { flexGrow: 1, flexBasis: '30%', minWidth: 140 },
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
})
