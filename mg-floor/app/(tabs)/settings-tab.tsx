import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { ModernGoldLogo } from '@/src/components/ModernGoldLogo'
import { brand, spacing } from '@/src/theme'

export default function SettingsTabScreen() {
  const { logout, user } = useAuth()
  const router = useRouter()

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <ModernGoldLogo height={48} />
        <Title>Settings</Title>
        <Subtitle>
          {brand.appName} · {user?.name || '—'}
        </Subtitle>
        <View style={styles.stack}>
          <BigButton label="Scan QR" onPress={() => router.push('/scan' as never)} tone="neutral" />
          <BigButton label="Profile" onPress={() => router.push('/profile' as never)} tone="neutral" />
          <BigButton label="Offline Sync" onPress={() => router.push('/offline-sync' as never)} tone="neutral" />
          <BigButton label="App Settings" onPress={() => router.push('/settings' as never)} tone="neutral" />
          <BigButton label="XRF / QC" onPress={() => router.push('/xrf' as never)} tone="neutral" />
          <BigButton label="Devices" onPress={() => router.push('/devices' as never)} tone="neutral" />
          <BigButton label="Scales" onPress={() => router.push('/scales' as never)} tone="neutral" />
          <BigButton label="Logout" onPress={() => logout()} tone="danger" />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stack: { marginTop: spacing.lg },
})
