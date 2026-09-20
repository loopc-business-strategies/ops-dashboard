import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthContext'
import { useIsTablet } from '@/src/components/ui'
import {
  NAV_ITEMS,
  PHONE_TABS,
  SECTION_LABELS,
  filterNavByPermissions,
} from '@/src/navigation/menu'
import { colors, spacing } from '@/src/theme'

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname === '' || pathname === '/index'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PhoneTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {PHONE_TABS.map((tab) => {
        const active = isActive(pathname, tab.href)
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as never)}
            style={styles.tabItem}
            accessibilityRole="button"
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function TabletSidebar() {
  const { permissions } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const items = filterNavByPermissions(NAV_ITEMS, permissions)
  const sections = ['production', 'qc', 'operations', 'devices', 'system'] as const

  return (
    <View style={styles.sidebar}>
      <Text style={styles.sideBrand}>MG FLOOR</Text>
      <ScrollView>
        {sections.map((section) => {
          const rows = items.filter((i) => i.section === section)
          if (!rows.length) return null
          return (
            <View key={section} style={styles.sideSection}>
              <Text style={styles.sideSectionTitle}>{SECTION_LABELS[section]}</Text>
              {rows.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => router.push(item.href as never)}
                    style={[styles.sideItem, active && styles.sideItemActive]}
                  >
                    <Text style={[styles.sideItemText, active && styles.sideItemTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

/** Wraps authenticated stack content with phone tabs or tablet rail. */
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
  return (
    <View style={styles.phoneCol}>
      <View style={styles.phoneContent}>{children}</View>
      <PhoneTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  phoneCol: { flex: 1, backgroundColor: colors.bg },
  phoneContent: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  tabLabelActive: { color: colors.accent },
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
    color: colors.accent,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sideSection: { marginBottom: spacing.md },
  sideSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    paddingHorizontal: spacing.sm,
  },
  sideItem: { paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: 6 },
  sideItemActive: { backgroundColor: colors.surfaceAlt },
  sideItemText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  sideItemTextActive: { color: colors.text },
  tabletContent: { flex: 1 },
})
