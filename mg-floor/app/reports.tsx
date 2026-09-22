import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { Screen, Subtitle, Title } from '@/src/components/ui'
import { AsyncSection } from '@/src/components/async'
import { fetchStatsSummary, fetchHistory } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { colors, spacing } from '@/src/theme'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function ReportsScreen() {
  const stats = useAsyncResource(
    useCallback(async (signal) => fetchStatsSummary({ from: startOfToday() }, { signal }), []),
    { cacheKey: 'mg-floor:reports-stats' },
  )
  const history = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchHistory({ limit: 30, from: startOfToday() }, { signal })
      return res.movements || []
    }, []),
    { cacheKey: 'mg-floor:reports-history', isEmpty: (d) => !d.length },
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Title>Reports</Title>
        <Subtitle>Daily production from live floor data</Subtitle>

        <Text style={styles.section}>DAILY PRODUCTION</Text>
        <AsyncSection status={stats.status} error={stats.error} onRetry={stats.reload} emptyMessage="No stats">
          {stats.data ? (
            <>
              <Text style={styles.line}>
                Metal IN · {stats.data.metalIn.count} tx · {Number(stats.data.metalIn.total).toFixed(2)} g · avg{' '}
                {Number(stats.data.metalIn.average).toFixed(2)} g
              </Text>
              <Text style={styles.line}>
                Metal OUT · {stats.data.metalOut.count} tx · {Number(stats.data.metalOut.total).toFixed(2)} g · avg{' '}
                {Number(stats.data.metalOut.average).toFixed(2)} g
              </Text>
            </>
          ) : null}
        </AsyncSection>

        <Text style={styles.section}>OPERATOR ACTIVITY (TODAY)</Text>
        <AsyncSection
          status={history.status}
          error={history.error}
          emptyMessage="No activity"
          onRetry={history.reload}
        >
          {((history.data || []) as Array<Record<string, unknown>>).slice(0, 20).map((m, i) => (
            <Text key={String(m._id || i)} style={styles.line}>
              {String(m.batchNumber || '—')} · {Number(m.weight || 0).toFixed(2)} g ·{' '}
              {String(m.receivedByName || m.issuedByName || '—')}
            </Text>
          ))}
        </AsyncSection>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    color: colors.accent,
    fontWeight: '900',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  line: { color: colors.text, marginBottom: 6, fontWeight: '600' },
})
