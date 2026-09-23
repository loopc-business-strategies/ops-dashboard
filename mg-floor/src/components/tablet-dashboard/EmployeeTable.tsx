import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

export type EmployeeRow = {
  name: string
  login: string
  logout: string
}

type Props = {
  employees: EmployeeRow[]
}

export function EmployeeTable({ employees }: Props) {
  const count = employees.length
  return (
    <View style={styles.card}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Employees - {count}</Text>
      </View>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.colHash, styles.headerCell]}>#</Text>
          <Text style={[styles.cell, styles.colName, styles.headerCell]}>Name</Text>
          <Text style={[styles.cell, styles.colTime, styles.headerCell]}>Login</Text>
          <Text style={[styles.cell, styles.colTime, styles.headerCell]}>Logout</Text>
        </View>
        {employees.map((e, i) => (
          <View key={`${e.name}-${i}`} style={styles.row}>
            <Text style={[styles.cell, styles.colHash, styles.muted]}>{i + 1}</Text>
            <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={[styles.cell, styles.colTime]}>{e.login || '--'}</Text>
            <Text style={[styles.cell, styles.colTime]}>{e.logout || '--'}</Text>
          </View>
        ))}
        <View style={styles.footer} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.white,
    minHeight: 0,
    overflow: 'hidden',
  },
  titleBar: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  title: {
    color: td.text,
    fontWeight: '700',
    fontSize: 16,
  },
  table: { flex: 1 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
    minHeight: 40,
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
  },
  cell: {
    color: td.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  headerCell: {
    fontWeight: '700',
    color: td.textMuted,
    fontSize: 13,
  },
  muted: { color: td.textMuted },
  colHash: { width: 40 },
  colName: { flex: 1.4, textAlign: 'left' },
  colTime: { flex: 1 },
  footer: {
    flex: 1,
    minHeight: 24,
    backgroundColor: td.cream,
  },
})
