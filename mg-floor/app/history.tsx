import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, LoadingBlock, Screen, Subtitle } from '@/src/components/ui'
import { fetchHistory } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function HistoryScreen() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchHistory({ limit: 50 })
      setRows((res.movements || []) as Array<Record<string, unknown>>)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    )
  }

  return (
    <Screen>
      <Subtitle>Metal movements (RBAC-filtered via MG Floor API)</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BigButton label="REFRESH" onPress={load} tone="neutral" />
      <FlatList
        data={rows}
        keyExtractor={(item, idx) => String(item._id || idx)}
        ListEmptyComponent={<Text style={styles.empty}>No history yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>
              {String(item.movementNumber || item._id)} · {String(item.weight ?? '')}g
            </Text>
            <Text style={styles.rowMeta}>
              {String(item.fromDepartment || '')} → {String(item.toDepartment || '')}
            </Text>
            <Text style={styles.rowMeta}>
              {String(item.status || '')} · {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : ''}
            </Text>
          </View>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  empty: { color: colors.textMuted, marginTop: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, marginTop: 4 },
})
