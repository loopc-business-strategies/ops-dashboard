import { Tabs } from 'expo-router'
import React from 'react'
import { useIsTablet } from '@/src/components/ui'
import { colors } from '@/src/theme'

export default function TabsLayout() {
  const tablet = useIsTablet()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: tablet
          ? { display: 'none' }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
    </Tabs>
  )
}
