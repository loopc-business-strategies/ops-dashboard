import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { useIsTablet } from '@/src/components/ui'
import { ModernGoldLogo } from '@/src/components/ModernGoldLogo'
import { AuthHeaderActions } from '@/src/navigation/AuthHeaderActions'
import { NAV_ITEMS, TABLET_SIDEBAR_KEYS, filterNavByPermissions } from '@/src/navigation/menu'
import { brand, colors, spacing } from '@/src/theme'

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname === '/index' || pathname.endsWith('/(tabs)') || pathname.endsWith('/(tabs)/')
  }
  return pathname === href || pathname.includes(href)
}

export function TabletSidebar() {
  const { permissions } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const allowed = filterNavByPermissions(NAV_ITEMS, permissions)
  const byKey = new Map(allowed.map((i) => [i.key, i]))
  const items = TABLET_SIDEBAR_KEYS.map((k) => byKey.get(k)).filter(Boolean)

  return (
    <View style={styles.sidebar}>
      <ModernGoldLogo height={40} style={{ marginBottom: spacing.sm }} />
      <Text style={styles.sideBrand}>{brand.appName}</Text>
      <View style={styles.sideAuth}>
        <AuthHeaderActions />
      </View>
      <ScrollView>
        {items.map((item) => {
          if (!item) return null
          const active = isActive(pathname, item.href)
          return (
            <Pressable
              key={item.key}
              onPress={() => router.replace(item.href as never)}
              style={[styles.sideItem, active && styles.sideItemActive]}
            >
              <Text style={[styles.sideItemText, active && styles.sideItemTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const tablet = useIsTablet()
  if (tablet) {
    return (
      <View style={styles.tabletRow}>
        <TabletSidebar />
        <View style={styles.tabletContent}>{children}</View>
      </View>
    )
  }
  return <>{children}</>
}

const styles = StyleSheet.create({
  tabletRow: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sideBrand: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sideAuth: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'flex-start',
  },
  sideItem: { paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: 8, marginBottom: 4 },
  sideItemActive: { backgroundColor: colors.accent },
  sideItemText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  sideItemTextActive: { color: colors.onAccent },
  tabletContent: { flex: 1 },
})
