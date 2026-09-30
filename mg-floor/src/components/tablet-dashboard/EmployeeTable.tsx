import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

const ROW_HEIGHT = 34
/** Employees visible at once; the rest scroll. */
const VISIBLE_ROWS = 4

export type EmployeeRow = {
  id?: string
  name: string
  login: string
  logout: string
  /** Still logged in on this tablet (shows a Logout button when onLogout is given). */
  active?: boolean
}

type Props = {
  employees: EmployeeRow[]
  onLogout?: (id: string) => void
}

export function EmployeeTable({ employees, onLogout }: Props) {
  const count = employees.filter((e) => e.active !== false).length
  return (
    <View style={styles.card}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Employees - {count}</Text>
      </View>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.colHash, styles.headerCell]}>#</Text>
        <Text style={[styles.cell, styles.colName, styles.headerCell]}>Name</Text>
        <Text style={[styles.cell, styles.colTime, styles.headerCell]}>Login</Text>
        <Text style={[styles.cell, styles.colTime, styles.headerCell]}>Logout</Text>
      </View>
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar>
        {employees.length === 0 ? <Text style={styles.empty}>No one logged in yet. Tap Login.</Text> : null}
        {employees.map((e, i) => {
          const canLogout = Boolean(onLogout && e.id && e.active)
          return (
            <View key={e.id || `${e.name}-${i}`} style={[styles.row, e.active === false && styles.rowOut]}>
              <Text style={[styles.cell, styles.colHash, styles.muted]}>{i + 1}</Text>
              <Text style={[styles.cell, styles.colName, e.active === false && styles.muted]} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={[styles.cell, styles.colTime]}>{e.login || '--'}</Text>
              <View style={styles.colTime}>
                {canLogout ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Logout ${e.name}`}
                    hitSlop={6}
                    onPress={() => onLogout?.(e.id as string)}
                    style={({ pressed }) => [styles.rowLogout, pressed && styles.rowLogoutPressed]}
                  >
                    <Text style={styles.rowLogoutText}>Logout</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cell}>{e.logout || '--'}</Text>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.white,
    overflow: 'hidden',
  },
  titleBar: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  title: {
    color: td.text,
    fontWeight: '700',
    fontSize: 14,
  },
  list: { height: VISIBLE_ROWS * ROW_HEIGHT },
  empty: { color: td.textMuted, fontSize: 12, textAlign: 'center', padding: 12 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  rowOut: { backgroundColor: '#FAFAFA' },
  headerRow: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
  },
  cell: {
    color: td.text,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  headerCell: {
    fontWeight: '700',
    color: td.textMuted,
    fontSize: 12,
  },
  muted: { color: td.textMuted },
  colHash: { width: 32 },
  colName: { flex: 1.4, textAlign: 'left' },
  colTime: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowLogout: {
    borderWidth: 1.5,
    borderColor: td.orange,
    borderRadius: td.buttonRadius,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: td.white,
  },
  rowLogoutPressed: { backgroundColor: td.cream },
  rowLogoutText: { color: td.orange, fontWeight: '700', fontSize: 12 },
})
