import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

export type DashboardLink = { key: string; label: string; onPress: () => void }

/** Secondary manager screens (captured weights, scale setup); renders nothing when no link is allowed. */
export function DashboardLinksRow({ links, compact }: { links: DashboardLink[]; compact?: boolean }) {
  if (!links.length) return null
  return (
    <View style={styles.row}>
      {links.map((link) => (
        <Pressable
          key={link.key}
          accessibilityRole="button"
          onPress={link.onPress}
          style={({ pressed }) => [styles.btn, compact && { minHeight: 40 }, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.text, compact && { fontSize: 13 }]} numberOfLines={1}>
            {link.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: td.white,
    borderWidth: 2,
    borderColor: td.orange,
    borderRadius: td.radius,
  },
  text: { color: td.orange, fontWeight: '800', fontSize: 15 },
})
