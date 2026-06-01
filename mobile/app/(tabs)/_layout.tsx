import { SymbolView } from 'expo-symbols'
import { Tabs, useRouter } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'
import { PlusTabButton } from '@/src/components/PlusTabButton'
import { mgBranding } from '@/src/config/branding'

export default function TabLayout() {
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: mgBranding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: mgBranding.colors.primary,
        tabBarInactiveTintColor: mgBranding.colors.tabInactive,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="erp"
        options={{
          title: 'ERP',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'chart.bar.doc.horizontal', android: 'assessment', web: 'assessment' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <PlusTabButton
              {...props}
              onPressOverride={() => router.push('/plus-modal')}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={24} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: mgBranding.colors.tabBar,
    borderTopColor: '#E5E7EB',
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
})
