import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import { useIsTablet } from '@/src/components/ui'
import { NAV_ITEMS, SECTION_LABELS, filterNavByPermissions } from '@/src/navigation/menu'
import { colors, spacing } from '@/src/theme'

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname === '/index' || pathname.endsWith('/(tabs)') || pathname.endsWith('/(tabs)/')
  }
  return pathname === href || pathname.includes(href)
}

/** Tablet sidebar only — phone uses Expo Router Tabs. Uses replace to avoid stack growth. */
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
                    onPress={() => router.replace(item.href as never)}
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

/** Wraps authenticated stack: tablet rail only (phone tabs live in (tabs)/_layout). */
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
