import React, { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { clearSynced, listOutbox, markOutbox, type OutboxItem } from '@/src/offline/outbox'
import { flushOutbox } from '@/src/offline/sync'
import { colors, spacing } from '@/src/theme'

export default function OfflineSyncScreen() {
  const [items, setItems] = useState<OutboxItem[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setItems(await listOutbox())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const syncNow = async () => {
    setBusy(true)
    try {
      const res = await flushOutbox()
      await clearSynced()
      await refresh()
      const conflicts = (await listOutbox()).filter((i) => i.syncStatus === 'CONFLICT').length
      Alert.alert(
        'Sync',
        conflicts
          ? `Processed ${res.synced} operation(s). ${conflicts} conflict(s) need supervisor review.`
          : `Processed ${res.synced} operation(s)`,
      )
    } catch (err) {
      Alert.alert('Sync failed', err instanceof Error ? err.message : 'Unknown error')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const retryFailed = async (item: OutboxItem) => {
    if (item.syncStatus === 'CONFLICT') {
      Alert.alert(
        'Conflict',
        'This operation conflicts with server state. A supervisor must resolve it — do not resubmit blindly.',
      )
      return
    }
    await markOutbox(item.operationId, { syncStatus: 'PENDING', errorMessage: undefined })
    await refresh()
    await syncNow()
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Pending floor operations stored on this device</Subtitle>
        <BigButton label={busy ? 'SYNCING…' : 'SYNC NOW'} onPress={syncNow} disabled={busy} />
        <BigButton label="REFRESH" onPress={refresh} tone="neutral" />
        {items.length === 0 ? (
          <Text style={styles.empty}>No pending operations</Text>
        ) : (
          items.map((item) => (
            <View key={item.operationId} style={styles.row}>
              <Text style={styles.id}>{item.operationType}</Text>
              <StatusPill
                label={item.syncStatus}
                tone={
                  item.syncStatus === 'SYNCED'
                    ? 'ok'
                    : item.syncStatus === 'FAILED' || item.syncStatus === 'CONFLICT'
                      ? 'bad'
                      : item.syncStatus === 'SYNCING'
                        ? 'warn'
                        : 'neutral'
                }
              />
              <Text style={styles.meta}>{item.operationId}</Text>
              {item.errorMessage ? <Text style={styles.err}>{item.errorMessage}</Text> : null}
              {item.syncStatus === 'CONFLICT' ? (
                <Text style={styles.warn}>
                  CONFLICT — needs supervisor review. Original operation was not overwritten.
                </Text>
              ) : null}
              {item.syncStatus === 'FAILED' || item.syncStatus === 'PENDING' ? (
                <BigButton
                  label="RETRY"
                  tone="neutral"
                  onPress={() => retryFailed(item)}
                  disabled={busy}
                />
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  row: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  id: { color: colors.text, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.textMuted, fontSize: 12 },
  err: { color: colors.danger, fontSize: 13 },
  warn: { color: colors.warning, fontSize: 13, fontWeight: '700' },
})
