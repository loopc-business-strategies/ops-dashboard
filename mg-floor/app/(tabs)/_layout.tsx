import React from 'react'
import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors } from '@/src/theme'
import { useIsTablet } from '@/src/components/ui'
import { AuthHeaderActions } from '@/src/navigation/AuthHeaderActions'

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? colors.accent : colors.textMuted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </Text>
  )
}

export default function TabsLayout() {
  const tablet = useIsTablet()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        // Phone: header Logout. Tablet: auth lives in sidebar only.
        headerRight: tablet ? undefined : () => <AuthHeaderActions />,
        tabBarStyle: tablet
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 64,
              paddingBottom: 8,
              paddingTop: 8,
            },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'MG FLOOR',
          tabBarLabel: ({ focused }) => <TabLabel label="HOME" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'BATCHES',
          tabBarLabel: ({ focused }) => <TabLabel label="BATCHES" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'HISTORY',
          tabBarLabel: ({ focused }) => <TabLabel label="HISTORY" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'REPORTS',
          tabBarLabel: ({ focused }) => <TabLabel label="REPORTS" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings-tab"
        options={{
          title: 'SETTINGS',
          tabBarLabel: ({ focused }) => <TabLabel label="SETTINGS" focused={focused} />,
        }}
      />
      <Tabs.Screen name="scan" options={{ href: null, title: 'SCAN' }} />
    </Tabs>
  )
}
