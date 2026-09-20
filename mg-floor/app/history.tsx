import React, { useCallback, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, Subtitle } from '@/src/components/ui'
import { AsyncSection, SectionLoading } from '@/src/components/async'
import { fetchHistory } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { colors, spacing } from '@/src/theme'

const PAGE = 50

export default function HistoryScreen() {
  const [skip, setSkip] = useState(0)
  const [extra, setExtra] = useState<Array<Record<string, unknown>>>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const history = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchHistory({ limit: PAGE, skip: 0 }, { signal })
      setExtra([])
      setSkip(0)
      return {
        movements: (res.movements || []) as Array<Record<string, unknown>>,
        total: Number(res.total || 0),
      }
    }, []),
    {
      isEmpty: (d) => !d.movements.length,
      cacheKey: 'mg-floor:history',
    },
  )

  const rows = [...(history.data?.movements || []), ...extra]
  const total = history.data?.total ?? rows.length

  const loadMore = async () => {
    if (loadingMore || rows.length >= total) return
    setLoadingMore(true)
    try {
      const nextSkip = skip + PAGE
      const res = await fetchHistory({ limit: PAGE, skip: nextSkip })
      setExtra((prev) => [...prev, ...((res.movements || []) as Array<Record<string, unknown>>)])
      setSkip(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Screen>
      <Subtitle>Metal movements (RBAC-filtered via MG Floor API)</Subtitle>
      <BigButton label="REFRESH" onPress={history.reload} tone="neutral" disabled={history.isLoading} />
      {history.status === 'loading' && !history.data ? <SectionLoading label="Loading history…" /> : null}
      <AsyncSection
        status={history.status === 'loading' && history.data ? 'retrying' : history.status}
        error={history.error || 'Unable to load history'}
        emptyMessage="No history yet"
        onRetry={history.reload}
        updatedAt={history.updatedAt}
        fromCache={history.fromCache}
      >
        {history.data || history.status === 'offline' ? (
          <FlatList
            data={rows}
            keyExtractor={(item, idx) => String(item._id || idx)}
            ListEmptyComponent={<Text style={styles.empty}>No history yet</Text>}
            ListFooterComponent={
              rows.length < total ? (
                <BigButton
                  label={loadingMore ? 'LOADING…' : 'LOAD MORE'}
                  onPress={loadMore}
                  tone="neutral"
                  disabled={loadingMore}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>
                  {String(item.movementNumber || item._id)} · {String(item.weight ?? '')}g
                </Text>
                <Text style={styles.rowMeta}>
                  {String(item.fromDepartment || '')} → {String(item.toDepartment || '')}
                </Text>
                <Text style={styles.rowMeta}>
                  {String(item.status || '')} ·{' '}
                  {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : ''}
                </Text>
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
  },
  rowTitle: { color: colors.text, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, marginTop: 4 },
})
