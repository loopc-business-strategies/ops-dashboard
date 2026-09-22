import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title, useIsTablet } from '@/src/components/ui'
import { callManager } from '@/src/api/factory'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

export default function HomeScreen() {
  const { department, user, employeeToken, logoutEmployee, logoutDepartment, enrollBiometric, biometricAvailable } =
    useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const [calling, setCalling] = useState(false)

  const onCallManager = async () => {
    if (!employeeToken) return
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

  return (
    <Screen>
      <Title>MG FACTORY</Title>
      <Subtitle>
        {department?.label || 'Department'} · {user?.name || 'Operator'}
      </Subtitle>

      <View style={[styles.actions, tablet && styles.actionsRow]}>
        <View style={tablet ? styles.actionCol : undefined}>
          <BigButton label="METAL IN" onPress={() => router.push('/metal-in')} tone="success" />
        </View>
        <View style={tablet ? styles.actionCol : undefined}>
          <BigButton label="METAL OUT" onPress={() => router.push('/metal-out')} />
        </View>
        <View style={tablet ? styles.actionCol : undefined}>
          <BigButton
            label={calling ? 'CALLING…' : 'CALL FLOOR MANAGER'}
            onPress={onCallManager}
            tone="danger"
            disabled={calling}
          />
        </View>
      </View>

      <View style={[styles.footer, tablet && styles.footerRow]}>
        {biometricAvailable ? (
          <View style={tablet ? styles.footerCol : undefined}>
            <BigButton
              label="ENABLE FACE ID"
              onPress={async () => {
                try {
                  await enrollBiometric()
                  Alert.alert('Face ID enabled', 'You can use Face ID on the next employee login.')
                } catch (err) {
                  Alert.alert('Face ID', userFacingMessage(err))
                }
              }}
              tone="neutral"
            />
          </View>
        ) : null}
        <View style={tablet ? styles.footerCol : undefined}>
          <BigButton
            label="EMPLOYEE LOGOUT"
            onPress={async () => {
              await logoutEmployee()
              router.replace('/employee-login')
            }}
            tone="neutral"
          />
        </View>
        <View style={tablet ? styles.footerCol : undefined}>
          <BigButton
            label="DEPARTMENT LOGOUT"
            onPress={async () => {
              await logoutDepartment()
              router.replace('/department-login')
            }}
            tone="neutral"
          />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  actions: { marginTop: spacing.xl, flex: 1, justifyContent: 'center' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    justifyContent: 'center',
  },
  actionCol: { flex: 1 },
  footer: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  footerCol: { flexGrow: 1, flexBasis: '30%', minWidth: 160 },
})
