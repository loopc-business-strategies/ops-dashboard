import React, { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { clearSynced, listOutbox, type OutboxItem } from '@/src/offline/outbox'
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
      Alert.alert('Sync', `Processed ${res.synced} operation(s)`)
    } catch (err) {
      Alert.alert('Sync failed', err instanceof Error ? err.message : 'Unknown error')
      await refresh()
    } finally {
      setBusy(false)
    }
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
                tone={item.syncStatus === 'SYNCED' ? 'ok' : item.syncStatus === 'FAILED' ? 'warn' : 'neutral'}
              />
              <Text style={styles.meta}>{item.operationId}</Text>
              {item.errorMessage ? <Text style={styles.err}>{item.errorMessage}</Text> : null}
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
  err: { color: colors.danger, fontSize: 12 },
})
