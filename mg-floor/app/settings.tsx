import React from 'react'
import { StyleSheet, Text } from 'react-native'
import Constants from 'expo-constants'
import { Screen, Subtitle } from '@/src/components/ui'
import { API_URL, APP_ENV, IS_PRODUCTION } from '@/src/config/env'
import { colors, spacing } from '@/src/theme'

export default function SettingsScreen() {
  let apiHost = API_URL
  try {
    apiHost = new URL(API_URL).host
  } catch {
    // keep raw
  }

  return (
    <Screen>
      <Subtitle>MG Floor — MG tenant only</Subtitle>
      <Text style={styles.label}>API</Text>
      <Text style={styles.value}>{apiHost}</Text>
      <Text style={styles.label}>Environment</Text>
      <Text style={styles.value}>{APP_ENV}{IS_PRODUCTION ? ' (production)' : ''}</Text>
      <Text style={styles.label}>App version</Text>
      <Text style={styles.value}>{Constants.expoConfig?.version || '1.0.0'}</Text>
      <Text style={styles.hint}>
        No Mongo credentials or JWT secrets are stored in this app. Offline operations persist on device until sync.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, marginTop: spacing.md, fontWeight: '700' },
  value: { color: colors.text, fontSize: 16, marginTop: 4 },
  hint: { color: colors.textMuted, marginTop: spacing.xl, fontSize: 13, lineHeight: 18 },
})
