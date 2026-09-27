import React, { useCallback, useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { AsyncSection, ErrorState, SectionLoading } from '@/src/components/async'
import {
  fetchWeightCaptures,
  weightCapturePhotoSource,
  type WeightCaptureMethod,
  type WeightCaptureRow,
} from '@/src/api/weightCaptures'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { useAuth } from '@/src/context/AuthContext'
import { userFacingMessage } from '@/src/api/errors'
import { captureMethodLabel } from '@/src/scaleCamera/weightCaptureService'
import { colors, spacing } from '@/src/theme'

const PAGE = 30
type Filter = 'ALL' | WeightCaptureMethod

/** Review of camera-OCR and manual weight captures with their scale-display photos. */
export default function WeightCapturesScreen() {
  const { permissions } = useAuth()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [extra, setExtra] = useState<WeightCaptureRow[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const canReview = Boolean(permissions.viewAudit || permissions.manageScales)

  const list = useAsyncResource(
    useCallback(
      async (signal) => {
        const res = await fetchWeightCaptures(
          { limit: PAGE, skip: 0, ...(filter !== 'ALL' ? { captureMethod: filter } : {}) },
          { signal },
        )
        setExtra([])
        setLoadMoreError('')
        return { rows: res.captures || [], total: Number(res.total ?? res.captures?.length ?? 0) }
      },
      [filter],
    ),
    { isEmpty: (d) => !d.rows.length, deps: [filter], enabled: canReview },
  )

  if (!canReview) {
    return (
      <Screen>
        <Subtitle>Not authorized — floor / production managers only</Subtitle>
      </Screen>
    )
  }

  const rows = [...(list.data?.rows || []), ...extra]
  const total = list.data?.total ?? rows.length
  const canLoadMore = rows.length < total

  const loadMore = async () => {
    if (loadingMore || !canLoadMore) return
    setLoadingMore(true)
    setLoadMoreError('')
    try {
      const res = await fetchWeightCaptures({
        limit: PAGE,
        skip: rows.length,
        ...(filter !== 'ALL' ? { captureMethod: filter } : {}),
      })
      setExtra((prev) => [...prev, ...(res.captures || [])])
    } catch (err) {
      setLoadMoreError(userFacingMessage(err) || 'Unable to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Screen>
      <Subtitle>Camera OCR and manual weight captures — compare each photo with the recorded weight</Subtitle>
      <View style={styles.filters}>
        {(['ALL', 'CAMERA_OCR', 'MANUAL'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
              {f === 'ALL' ? 'ALL' : captureMethodLabel(f)}
            </Text>
          </Pressable>
        ))}
      </View>
      {list.status === 'loading' && !list.data ? <SectionLoading label="Loading captures…" /> : null}
      <AsyncSection
        status={list.status === 'loading' && list.data ? 'retrying' : list.status}
        error={list.error || 'Unable to load captures'}
        emptyMessage="No camera or manual captures yet"
        onRetry={list.reload}
        updatedAt={list.updatedAt}
        fromCache={list.fromCache}
        stale={list.stale}
      >
        {list.data ? (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.captureId}
            ListFooterComponent={
              <View style={styles.footer}>
                <Text style={styles.meta}>
                  Showing {rows.length} of {total}
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
              const hasPhoto = item.photo?.status === 'UPLOADED'
              const open = expanded === item.captureId
              return (
                <View style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.weight}>
                      {Number(item.weight).toFixed(2)} {item.unit}
                    </Text>
                    <StatusPill
                      label={captureMethodLabel(item.captureMethod)}
                      tone={item.captureMethod === 'MANUAL' ? 'warn' : 'neutral'}
                    />
                    <StatusPill
                      label={item.status === 'CONSUMED' ? `USED · ${item.consumedBy?.operationType || ''}` : 'NOT USED'}
                      tone={item.status === 'CONSUMED' ? 'ok' : 'neutral'}
                    />
                    {item.overCapacityReview ? <StatusPill label="ABOVE CAPACITY" tone="bad" /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {item.scaleId} · {item.employeeName || '—'} · {item.department || '—'}
                    {item.batchNumber ? ` · ${item.batchNumber}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {item.capturedAt ? new Date(item.capturedAt).toLocaleString() : '—'} · device {item.deviceId || '—'}
                  </Text>
                  {item.captureMethod === 'CAMERA_OCR' ? (
                    <Text style={styles.meta}>
                      OCR {item.ocrRawText ? `"${item.ocrRawText}"` : '—'} · confidence{' '}
                      {item.ocrConfidence != null ? `${Math.round(item.ocrConfidence * 100)}%` : '—'}
                      {item.crossCheckAgreed ? ' · engines agreed' : ''}
                    </Text>
                  ) : (
                    <Text style={styles.meta}>Reason: {item.manualReason || '—'}</Text>
                  )}
                  {hasPhoto ? (
                    <Pressable onPress={() => setExpanded(open ? null : item.captureId)}>
                      <Image
                        source={weightCapturePhotoSource(item.captureId)}
                        style={open ? styles.photoLarge : styles.photo}
                        resizeMode="contain"
                      />
                    </Pressable>
                  ) : item.captureMethod === 'CAMERA_OCR' ? (
                    <Text style={styles.meta}>
                      Photo {item.photo?.status === 'PENDING' ? 'waiting for upload from the tablet' : 'not available'}
                    </Text>
                  ) : null}
                </View>
              )
            }}
          />
        ) : null}
      </AsyncSection>
    </Screen>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  filter: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.text, fontWeight: '700' },
  filterTextOn: { color: colors.onAccent },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  weight: { color: colors.text, fontWeight: '800', fontSize: 20, fontVariant: ['tabular-nums'] },
  meta: { color: colors.textMuted, fontSize: 12 },
  photo: { width: 220, height: 124, borderRadius: 6, backgroundColor: '#000' },
  photoLarge: { width: '100%', height: 360, borderRadius: 6, backgroundColor: '#000' },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
})
