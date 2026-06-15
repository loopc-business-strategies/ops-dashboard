import { useMemo } from 'react'
import { SymbolView } from 'expo-symbols'
import { Tabs, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlusTabButton } from '@/src/components/PlusTabButton'
import { MgTabsHeader } from '@/src/components/MgTabsHeader'
import { mgBranding } from '@/src/config/branding'

const TAB_PADDING_TOP = 8
/** Minimum row for icons + labels (avoids clipping). */
const TAB_INNER_HEIGHT = 48
/** Padding above OS home indicator / Android nav bar. */
const TAB_PADDING_ABOVE_INSET = 8

export default function TabLayout() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const tabBarStyle = useMemo(() => {
    const paddingBottom = TAB_PADDING_ABOVE_INSET + insets.bottom
    const height = TAB_PADDING_TOP + TAB_INNER_HEIGHT + paddingBottom
    return {
      backgroundColor: mgBranding.colors.tabBar,
      borderTopColor: '#E5E7EB',
      height,
      paddingTop: TAB_PADDING_TOP,
      paddingBottom,
    }
  }, [insets.bottom])

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: (props) => (
          <MgTabsHeader options={props.options} route={props.route} />
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: mgBranding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: mgBranding.colors.primary,
        tabBarInactiveTintColor: mgBranding.colors.tabInactive,
        tabBarStyle,
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
