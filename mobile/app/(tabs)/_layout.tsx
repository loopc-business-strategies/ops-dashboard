import { useMemo } from 'react'
import { SymbolView } from 'expo-symbols'
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTabsHeader } from '@/src/components/AppTabsHeader'
import { useAuth } from '@/src/context/AuthContext'
import { useTenant } from '@/src/context/TenantContext'

const TAB_PADDING_TOP = 8
/** Minimum row for icons + labels (avoids clipping). */
const TAB_INNER_HEIGHT = Platform.OS === 'ios' ? 56 : 48
/**
 * With `edgeToEdgeEnabled=true`, some OEMs (e.g. MIUI) report `insets.bottom === 0` while the 3-button
 * nav bar still occludes ~48?56dp. A small floor (8) is not enough ? use a classic nav-bar reserve.
 */
const ANDROID_TAB_BAR_BOTTOM_MIN = 52

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bootBottom = initialWindowMetrics?.insets.bottom ?? 0
  const { tenantSessionKey } = useAuth()
  const { branding } = useTenant()

  /** Edge-to-edge: lift tab content above system gesture / 3-button bar even when JS insets are wrong. */
  const tabBarStyle = useMemo(() => {
    const paddingBottom =
      Platform.OS === 'ios'
        ? Math.max(insets.bottom, 24)
        : Math.max(insets.bottom, bootBottom, ANDROID_TAB_BAR_BOTTOM_MIN)
    const height = TAB_PADDING_TOP + TAB_INNER_HEIGHT + paddingBottom
    return {
      backgroundColor: branding.colors.tabBar,
      borderTopColor: '#E5E7EB',
      height,
      paddingTop: TAB_PADDING_TOP,
      paddingBottom,
    }
  }, [insets.bottom, bootBottom, branding.colors.tabBar])

  return (
    <Tabs
      key={tenantSessionKey}
      screenOptions={{
        headerShown: true,
        header: (props) => (
          <AppTabsHeader options={props.options} route={props.route} />
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: branding.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: branding.colors.primary,
        tabBarInactiveTintColor: branding.colors.tabInactive,
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
        name="chat"
        options={{
          href: null,
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' }} tintColor={color} size={24} />
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
