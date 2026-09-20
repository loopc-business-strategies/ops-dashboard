import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { BigButton, LoadingBlock, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { fetchScales, fetchXrfDevices } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function DevicesScreen() {
  const [loading, setLoading] = useState(true)
  const [scales, setScales] = useState<Array<Record<string, unknown>>>([])
  const [xrf, setXrf] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, x] = await Promise.all([
        fetchScales().catch(() => ({ scales: [] as Array<Record<string, unknown>> })),
        fetchXrfDevices().catch(() => ({ devices: [] as Array<Record<string, unknown>> })),
      ])
      setScales(s.scales || [])
      setXrf(x.devices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
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
        <LoadingBlock label="Loading devices…" />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scales and XRF — app stays usable when devices are offline</Subtitle>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <BigButton label="REFRESH" onPress={load} tone="neutral" />
        <Text style={styles.section}>SCALES</Text>
        {scales.length === 0 ? <Text style={styles.empty}>No scales reported</Text> : null}
        {scales.map((s) => (
          <View key={String(s.scaleId)} style={styles.card}>
            <Text style={styles.title}>{String(s.scaleId)}</Text>
            <StatusPill label={String(s.status || 'UNKNOWN')} tone="neutral" />
            <Text style={styles.meta}>
              {String(s.connectionType || '—')} · last {s.lastSeenAt ? String(s.lastSeenAt) : 'never'}
            </Text>
          </View>
        ))}
        <Text style={styles.section}>XRF</Text>
        {xrf.length === 0 ? <Text style={styles.empty}>No analyzers registered</Text> : null}
        {xrf.map((d) => (
          <View key={String(d.analyzerId)} style={styles.card}>
            <Text style={styles.title}>{String(d.analyzerId)}</Text>
            <StatusPill label={String(d.status || 'UNKNOWN')} tone="neutral" />
            <Text style={styles.meta}>
              {String(d.manufacturer || 'LANScientific')} {String(d.model || '(model TBD)')} ·{' '}
              {String(d.connectionType || 'UNKNOWN')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    color: colors.accent,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: 6,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted },
  err: { color: '#f87171', marginBottom: spacing.sm },
})
