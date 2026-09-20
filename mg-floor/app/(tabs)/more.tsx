import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, Subtitle, Title } from '@/src/components/ui'
import { NAV_ITEMS, filterNavByPermissions } from '@/src/navigation/menu'
import { spacing } from '@/src/theme'

/** Phone overflow menu for production / devices / system routes. */
export default function MoreScreen() {
  const { permissions, logout } = useAuth()
  const router = useRouter()
  const items = filterNavByPermissions(
    NAV_ITEMS.filter((i) => i.tab === 'more' && i.key !== 'home'),
    permissions,
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Title>MORE</Title>
        <Subtitle>Production, QC, devices, and system</Subtitle>
        <View style={styles.stack}>
          {items.map((item) => (
            <BigButton key={item.key} label={item.label} onPress={() => router.replace(item.href as never)} />
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
