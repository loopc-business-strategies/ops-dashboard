import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MetalTickerBar } from '@/src/components/MetalTickerBar'
import { mgBranding } from '@/src/config/branding'
import { useLiveMetalTickerState } from '@/src/context/LiveMetalTickerContext'

type TabHeaderProps = {
  options: { title?: string }
  route: { name: string }
}

function resolveTitle(routeName: string, rawTitle: string | undefined): string {
  const t = String(rawTitle ?? '').trim()
  if (t) return t
  const map: Record<string, string> = {
    home: 'Home',
    erp: 'ERP',
    chat: 'Chat',
    settings: 'Settings',
    plus: '',
    index: '',
  }
  return map[routeName] ?? routeName
}

/** Custom tab header: metal ticker strip + primary title bar (matches web MG top bar). */
export function MgTabsHeader({ options, route }: TabHeaderProps) {
  const insets = useSafeAreaInsets()
  const { snapshot, deltas, error } = useLiveMetalTickerState()
  const title = resolveTitle(route.name, options.title)

  return (
    <View style={styles.wrap}>
      <View style={{ paddingTop: insets.top }}>
        <MetalTickerBar snapshot={snapshot} deltas={deltas} errorMessage={error} />
      </View>
      <View style={styles.titleBar}>
        <Text style={styles.titleText}>{title || ' '}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mgBranding.colors.primary,
  },
  titleBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mgBranding.colors.primary,
  },
  titleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
})
