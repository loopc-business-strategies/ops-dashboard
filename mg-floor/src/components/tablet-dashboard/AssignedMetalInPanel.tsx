import React from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

type Props = {
  batch1: string
  batch2: string
  onChange: (next: { batch1: string; batch2: string }) => void
  compact?: boolean
}

export function AssignedMetalInPanel({ batch1, batch2, onChange, compact }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.headerText, compact && { fontSize: 13 }]}>Assigned Metal In</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.lineRow}>
          <Text style={styles.label}>Batch 1</Text>
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.input}
            value={batch1}
            onChangeText={(v) => onChange({ batch1: v, batch2 })}
            placeholder=""
            placeholderTextColor={td.textMuted}
          />
        </View>
        <View style={styles.lineRow}>
          <Text style={styles.label}>Batch 2</Text>
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.input}
            value={batch2}
            onChangeText={(v) => onChange({ batch1, batch2: v })}
            placeholder=""
            placeholderTextColor={td.textMuted}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: td.border,
    borderRadius: td.radius,
    backgroundColor: td.white,
    marginTop: 8,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerText: {
    color: td.text,
    fontWeight: '700',
    fontSize: 15,
  },
  body: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: td.text,
    fontWeight: '600',
    fontSize: 14,
    width: 64,
  },
  colon: {
    color: td.textMuted,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: td.text,
    fontWeight: '500',
    fontSize: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
    paddingVertical: 4,
    minHeight: 32,
  },
})
