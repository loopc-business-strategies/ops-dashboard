import React, { useCallback } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { AsyncSection, SectionLoading } from '@/src/components/async'
import { fetchJobs } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { colors, spacing } from '@/src/theme'

export default function JobsScreen() {
  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      return (Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? (raw as { tasks: unknown[] }).tasks
          : []) as Array<Record<string, unknown>>
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:jobs' },
  )

  return (
    <Screen>
      <Subtitle>Authorized production jobs for this employee</Subtitle>
      <BigButton label="REFRESH" onPress={jobs.reload} tone="neutral" disabled={jobs.isLoading} />
      {jobs.status === 'loading' && !jobs.data ? <SectionLoading label="Loading jobs…" /> : null}
      <AsyncSection
        status={jobs.status === 'loading' && jobs.data ? 'retrying' : jobs.status}
        loadingLabel="Loading jobs…"
        error={jobs.error || 'Unable to load jobs'}
        emptyMessage="No jobs assigned."
        onRetry={jobs.reload}
        updatedAt={jobs.updatedAt}
        fromCache={jobs.fromCache}
      >
        {jobs.data ? (
          <FlatList
            data={jobs.data}
            keyExtractor={(item, idx) => String(item._id || item.batchId || item.passId || idx)}
            ListEmptyComponent={
              jobs.status === 'empty' || jobs.status === 'success' ? (
                <Text style={styles.empty}>No jobs assigned.</Text>
              ) : null
            }
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
        ) : null}
      </AsyncSection>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted },
})
