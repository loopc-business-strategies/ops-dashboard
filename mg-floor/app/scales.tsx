import React, { useCallback, useState } from 'react'
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { AsyncSection, ErrorState, HardwareStatus, SectionLoading } from '@/src/components/async'
import { fetchScaleStatus, fetchScalesFull } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useAuth } from '@/src/context/AuthContext'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

type ScaleRow = Record<string, unknown>
type StatusDetail = Record<string, unknown> | null

const PAGE = 50

export default function ScalesScreen() {
  const { permissions } = useAuth()
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [skip, setSkip] = useState(0)
  const [extra, setExtra] = useState<ScaleRow[]>([])
  const [loadMoreError, setLoadMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [detail, setDetail] = useState<StatusDetail>(null)
  const [detailScaleId, setDetailScaleId] = useState('')
  const [detailError, setDetailError] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  const scales = useAsyncResource(
    useCallback(
      async (signal) => {
        const res = await fetchScalesFull(
          {
            limit: PAGE,
            skip: 0,
            ...(appliedSearch.trim() ? { search: appliedSearch.trim() } : {}),
          },
          { signal },
        )
        setExtra([])
        setSkip(0)
        setLoadMoreError('')
        return {
          rows: (res.scales || []) as ScaleRow[],
          total: Number(res.total ?? res.scales?.length ?? 0),
        }
      },
      [appliedSearch],
    ),
    {
      isEmpty: (d) => !d.rows.length,
      cacheKey: `mg-floor:scales-full:${appliedSearch}`,
      deps: [appliedSearch],
    },
  )

  const rows = [...(scales.data?.rows || []), ...extra]
  const total = scales.data?.total ?? rows.length
  const canLoadMore = rows.length < total

  const loadMore = async () => {
    if (loadingMore || !canLoadMore) return
    setLoadingMore(true)
    setLoadMoreError('')
    const nextSkip = (scales.data?.rows.length || 0) + extra.length
    try {
      const res = await fetchScalesFull({
        limit: PAGE,
        skip: nextSkip,
        ...(appliedSearch.trim() ? { search: appliedSearch.trim() } : {}),
      })
      const more = (res.scales || []) as ScaleRow[]
      setExtra((prev) => [...prev, ...more])
      setSkip(nextSkip)
    } catch (err) {
      setLoadMoreError(userFacingMessage(err) || 'Unable to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  const canSeeRaw = permissions.manageScales !== false && Boolean(permissions.manageScales)

  return (
    <Screen>
      <Subtitle>Registered MG scales — status & diagnostics</Subtitle>
      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Search scale ID, model, department…"
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={() => setAppliedSearch(search.trim())}
      />
      <BigButton
        label="SEARCH"
        onPress={() => setAppliedSearch(search.trim())}
        tone="neutral"
        disabled={scales.isLoading}
      />
      <BigButton label="REFRESH" onPress={scales.reload} tone="neutral" disabled={scales.isLoading} />
      {scales.status === 'loading' && !scales.data ? <SectionLoading label="Loading scales…" /> : null}
      <AsyncSection
        status={scales.status === 'loading' && scales.data ? 'retrying' : scales.status}
        error={scales.error || 'Unable to connect to backend.'}
        emptyMessage="No scales registered"
        onRetry={scales.reload}
        updatedAt={scales.updatedAt}
        fromCache={scales.fromCache}
        stale={scales.stale}
        slow={scales.slow}
      >
        {scales.data ? (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.scaleId)}
            ListFooterComponent={
              <View style={styles.footer}>
                <Text style={styles.meta}>
                  Showing {rows.length} of {total}
                  {skip > 0 ? ` · skip ${skip}` : ''}
                </Text>
                {loadMoreError ? <ErrorState message={loadMoreError} onRetry={loadMore} /> : null}
                {canLoadMore ? (
                  <BigButton
                    label={loadingMore ? 'LOADING…' : 'LOAD MORE'}
                    onPress={loadMore}
                    tone="neutral"
                    disabled={loadingMore}
                  />
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const status = String(item.status || 'UNKNOWN')
              const tone =
                status === 'STABLE' || status === 'CONNECTED'
                  ? 'ok'
                  : status === 'ERROR' || status === 'DISCONNECTED' || status === 'DISABLED'
                    ? 'bad'
                    : 'warn'
              return (
                <View style={styles.row}>
                  <Text style={styles.title}>{String(item.scaleId)}</Text>
                  <Text style={styles.meta}>
                    {String(item.model || '')} · {String(item.connectionType || '')} ·{' '}
                    {String(item.department || 'unassigned')}
                  </Text>
                  <StatusPill label={status} tone={tone} />
                  <Text style={styles.meta}>
                    Last: {item.lastWeight != null ? `${item.lastWeight} g` : '—'} ·{' '}
                    {item.lastSeenAt ? new Date(String(item.lastSeenAt)).toLocaleString() : 'never'}
                  </Text>
                  <BigButton
                    label="READ STATUS"
                    tone="neutral"
                    onPress={async () => {
                      setDetailError('')
                      setDetail(null)
                      setDetailScaleId(String(item.scaleId))
                      setShowRaw(false)
                      try {
                        const s = await fetchScaleStatus(String(item.scaleId))
                        setDetail(s as Record<string, unknown>)
                      } catch (err) {
                        setDetailError(userFacingMessage(err) || 'Status read failed')
                      }
                    }}
                  />
                </View>
              )
            }}
          />
        ) : null}
      </AsyncSection>

      {detailError ? <Text style={styles.err}>{detailError}</Text> : null}
      {detail ? (
        <View style={styles.diag}>
          <Text style={styles.diagTitle}>DIAGNOSTICS — {detailScaleId}</Text>
          <HardwareStatus label="CONNECTION" status={String(detail.status || 'UNKNOWN')} />
          <Text style={styles.meta}>
            Last seen:{' '}
            {detail.lastSeenAt ? new Date(String(detail.lastSeenAt)).toLocaleString() : 'never'}
          </Text>
          <Text style={styles.meta}>
            Weight: {detail.lastWeight != null ? `${detail.lastWeight}` : '—'} · Stable:{' '}
            {detail.lastStable == null ? '—' : detail.lastStable ? 'YES' : 'NO'}
          </Text>
          <Text style={styles.meta}>
            Gateway: {String((detail as { gatewayId?: string }).gatewayId || '—')}
          </Text>
          <Text style={styles.meta}>
            Last error: {detail.lastError ? String(detail.lastError) : 'none'}
          </Text>
          {canSeeRaw ? (
            <>
              <BigButton
                label={showRaw ? 'HIDE RAW' : 'SHOW RAW (TECH)'}
                tone="neutral"
                onPress={() => setShowRaw((v) => !v)}
              />
              {showRaw ? <Text style={styles.raw}>{JSON.stringify(detail, null, 2)}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: 14,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.textMuted, fontSize: 12 },
  err: { color: colors.danger, marginTop: spacing.sm },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
  diag: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  diagTitle: { color: colors.accent, fontWeight: '800', letterSpacing: 0.5 },
  raw: { color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
})
