import React, { useCallback, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { AsyncSection, SectionLoading } from '@/src/components/async'
import { fetchScaleStatus, fetchScalesFull } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { userFacingMessage } from '@/src/api/errors'
import { colors, spacing } from '@/src/theme'

export default function ScalesScreen() {
  const [detail, setDetail] = useState('')
  const [detailError, setDetailError] = useState('')

  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchScalesFull({}, { signal })
      return res.scales || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:scales-full' },
  )

  return (
    <Screen>
      <Subtitle>Registered MG scales — status & diagnostics</Subtitle>
      <BigButton label="REFRESH" onPress={scales.reload} tone="neutral" disabled={scales.isLoading} />
      {scales.status === 'loading' && !scales.data ? <SectionLoading label="Loading scales…" /> : null}
      <AsyncSection
        status={scales.status === 'loading' && scales.data ? 'retrying' : scales.status}
        error={scales.error || 'Unable to connect to backend.'}
        emptyMessage="No scales registered"
        onRetry={scales.reload}
        updatedAt={scales.updatedAt}
        fromCache={scales.fromCache}
      >
        {scales.data ? (
          <FlatList
            data={scales.data}
            keyExtractor={(item) => String(item.scaleId)}
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
                      try {
                        const s = await fetchScaleStatus(String(item.scaleId))
                        setDetail(JSON.stringify(s, null, 2))
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
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 8,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  meta: { color: colors.textMuted },
  detail: { color: colors.text, fontFamily: 'monospace', fontSize: 11, marginTop: spacing.md },
  err: { color: colors.danger, marginTop: spacing.sm },
})
