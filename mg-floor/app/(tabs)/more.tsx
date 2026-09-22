import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { NAV_ITEMS, filterNavByPermissions } from '@/src/navigation/menu'
import { spacing } from '@/src/theme'

/** Phone overflow / reports hub. */
export default function MoreScreen() {
  const { permissions, logout } = useAuth()
  const router = useRouter()
  const items = filterNavByPermissions(
    NAV_ITEMS.filter((i) => ['reports', 'call-manager', 'xrf', 'devices', 'scales', 'offline', 'profile', 'transfer', 'correction'].includes(i.key)),
    permissions,
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Title>Reports & More</Title>
        <Subtitle>Production reports, QC, devices, system</Subtitle>
        <View style={styles.stack}>
          <BigButton label="Reports" onPress={() => router.push('/reports' as never)} />
          {items.map((item) => (
            <BigButton key={item.key} label={item.label} onPress={() => router.push(item.href as never)} />
          ))}
          <BigButton label="SIGN OUT" onPress={() => logout()} tone="danger" />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stack: { marginTop: spacing.lg },
})
