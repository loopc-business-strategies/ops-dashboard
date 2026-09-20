import React from 'react'
import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors } from '@/src/theme'
import { useIsTablet } from '@/src/components/ui'

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
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
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
        name="scan"
        options={{
          title: 'SCAN',
          tabBarLabel: ({ focused }) => <TabLabel label="SCAN" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'MY JOBS',
          tabBarLabel: ({ focused }) => <TabLabel label="JOBS" focused={focused} />,
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
          title: 'MORE',
          tabBarLabel: ({ focused }) => <TabLabel label="MORE" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
