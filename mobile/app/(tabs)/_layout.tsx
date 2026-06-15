import { useMemo } from 'react'
import { SymbolView } from 'expo-symbols'
import { Tabs, useRouter } from 'expo-router'
import { Platform } from 'react-native'
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlusTabButton } from '@/src/components/PlusTabButton'
import { MgTabsHeader } from '@/src/components/MgTabsHeader'
import { mgBranding } from '@/src/config/branding'

const TAB_PADDING_TOP = 8
/** Minimum row for icons + labels (avoids clipping). */
const TAB_INNER_HEIGHT = Platform.OS === 'ios' ? 56 : 48
/**
 * With `edgeToEdgeEnabled=true`, some OEMs (e.g. MIUI) report `insets.bottom === 0` while the 3-button
 * nav bar still occludes ~48–56dp. A small floor (8) is not enough — use a classic nav-bar reserve.
 */
const ANDROID_TAB_BAR_BOTTOM_MIN = 52

export default function TabLayout() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bootBottom = initialWindowMetrics?.insets.bottom ?? 0

  /** Edge-to-edge: lift tab content above system gesture / 3-button bar even when JS insets are wrong. */
  const tabBarStyle = useMemo(() => {
    const paddingBottom =
      Platform.OS === 'ios'
        ? Math.max(insets.bottom, 24)
        : Math.max(insets.bottom, bootBottom, ANDROID_TAB_BAR_BOTTOM_MIN)
    const height = TAB_PADDING_TOP + TAB_INNER_HEIGHT + paddingBottom
    return {
      backgroundColor: mgBranding.colors.tabBar,
      borderTopColor: '#E5E7EB',
      height,
      paddingTop: TAB_PADDING_TOP,
      paddingBottom,
    }
  }, [insets.bottom, bootBottom])

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
