import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, LoadingBlock, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { fetchJobs } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJobs()
      const raw = res.jobs
      // liveFloor may return { tasks: [...] } nested or array
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? ((raw as { tasks: unknown[] }).tasks as Array<Record<string, unknown>>)
          : []
      setJobs(list as Array<Record<string, unknown>>)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
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
        <LoadingBlock label="Loading jobs…" />
      </Screen>
    )
  }

  return (
    <Screen>
      <Subtitle>Authorized production jobs for this employee</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BigButton label="REFRESH" onPress={load} tone="neutral" />
      <FlatList
        data={jobs}
        keyExtractor={(item, idx) => String(item._id || item.batchId || item.passId || idx)}
        ListEmptyComponent={<Text style={styles.empty}>No jobs assigned</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>
              {String(item.batchNumber || item.passNumber || item._id || 'Job')}
            </Text>
            <Text style={styles.rowMeta}>
              {String(item.currentDepartment || item.toDepartment || item.fromDepartment || '')}
              {item.status ? ` · ${String(item.status)}` : ''}
            </Text>
            {item.priority ? <StatusPill label={String(item.priority)} tone="warn" /> : null}
          </View>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  error: { color: colors.danger, marginVertical: spacing.sm },
  empty: { color: colors.textMuted, marginTop: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  rowTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  rowMeta: { color: colors.textMuted },
})
