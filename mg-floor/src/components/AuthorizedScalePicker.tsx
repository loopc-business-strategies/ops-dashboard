import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BigButton } from '@/src/components/ui'
import { ErrorState, SectionLoading } from '@/src/components/async'
import type { useAuthorizedScaleIds } from '@/src/hooks/useAuthorizedScaleIds'
import { colors, spacing } from '@/src/theme'

type ScaleIdsApi = ReturnType<typeof useAuthorizedScaleIds>

/** Authorized scale ID chips + Load more (page size is not a max). */
export function AuthorizedScalePicker({
  scaleId,
  onSelect,
  scales,
}: {
  scaleId: string
  onSelect: (id: string) => void
  scales: ScaleIdsApi
}) {
  return (
    <View>
      {scales.status === 'loading' && !scales.ids.length ? <SectionLoading label="Loading scales…" /> : null}
      {scales.status === 'error' && !scales.ids.length ? (
        <ErrorState message={scales.error || 'Unable to load scales'} onRetry={scales.reload} />
      ) : null}
      <View style={styles.scaleRow}>
        {scales.ids.map((id) => (
          <BigButton
            key={id}
            label={id === scaleId ? `✓ ${id}` : id}
            tone={id === scaleId ? 'accent' : 'neutral'}
            onPress={() => onSelect(id)}
          />
        ))}
      </View>
      {scales.ids.length ? (
        <Text style={styles.meta}>
          Showing {scales.ids.length} of {scales.total}
        </Text>
      ) : null}
      {scales.canLoadMore ? (
        <BigButton
          label={scales.loadingMore ? 'LOADING…' : 'LOAD MORE SCALES'}
          tone="neutral"
          onPress={scales.loadMore}
          disabled={scales.loadingMore}
        />
      ) : null}
      {scales.loadMoreError ? <Text style={styles.err}>{scales.loadMoreError}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  err: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
})
