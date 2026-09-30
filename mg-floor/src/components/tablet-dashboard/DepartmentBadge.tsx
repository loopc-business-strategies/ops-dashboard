import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { floorDepartmentLabel } from '@/src/config/floorDepartments'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  department: string
  loggedIn: boolean
}

export function DepartmentBadge({ department, loggedIn }: Props) {
  const missing = loggedIn && !department
  return (
    <View style={[styles.bar, missing && styles.warn]} accessibilityRole="text">
      <Text style={styles.label}>Department</Text>
      <Text style={[styles.value, missing && styles.warnText]} numberOfLines={2}>
        {missing
          ? 'Not assigned — ask an admin'
          : department
            ? floorDepartmentLabel(department)
            : '—'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.cream,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  warn: { borderColor: td.orange },
  label: { color: td.textMuted, fontWeight: '700', fontSize: 13 },
  value: { color: td.text, fontWeight: '800', fontSize: 15, flexShrink: 1, textAlign: 'right' },
  warnText: { color: td.orange },
})
