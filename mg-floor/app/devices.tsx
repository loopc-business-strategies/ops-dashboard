import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { BigButton, Screen, StatusPill, Subtitle } from '@/src/components/ui'
import { AsyncSection, HardwareStatus } from '@/src/components/async'
import { fetchScalesFull, fetchXrfDevices } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { colors, spacing } from '@/src/theme'

export default function DevicesScreen() {
  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchScalesFull({}, { signal })
      return res.scales || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:devices-scales' },
  )

  const xrf = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchXrfDevices({ signal })
      return res.devices || []
    }, []),
    { isEmpty: (d) => !d.length, cacheKey: 'mg-floor:devices-xrf' },
  )

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Subtitle>Scales and XRF — sections load independently</Subtitle>
        <BigButton
          label="REFRESH ALL"
          onPress={() => {
            scales.reload()
            xrf.reload()
          }}
          tone="neutral"
        />

        <Text style={styles.section}>SCALES</Text>
        <AsyncSection
          status={scales.status}
          loadingLabel="Loading scales…"
          error={scales.error || 'Unable to load scales'}
          emptyMessage="No scales registered"
          onRetry={scales.reload}
          updatedAt={scales.updatedAt}
          fromCache={scales.fromCache}
        >
          {(scales.data || []).map((s) => (
            <View key={String(s.scaleId)} style={styles.card}>
              <Text style={styles.title}>{String(s.scaleId)}</Text>
              <HardwareStatus label="STATUS" status={String(s.status || 'UNKNOWN')} />
              <Text style={styles.meta}>
                {String(s.connectionType || '—')} · last {s.lastSeenAt ? String(s.lastSeenAt) : 'never'}
              </Text>
            </View>
          ))}
        </AsyncSection>

        <Text style={styles.section}>XRF ANALYZERS</Text>
        <AsyncSection
          status={xrf.status}
          loadingLabel="Loading XRF…"
          error={xrf.error || 'Unable to load XRF devices'}
          emptyMessage="No analyzers registered"
          onRetry={xrf.reload}
          updatedAt={xrf.updatedAt}
          fromCache={xrf.fromCache}
        >
          {(xrf.data || []).map((d) => (
            <View key={String(d.analyzerId)} style={styles.card}>
              <Text style={styles.title}>{String(d.analyzerId)}</Text>
              <StatusPill label={String(d.status || 'UNKNOWN')} tone="neutral" />
              <Text style={styles.meta}>
                {String(d.manufacturer || 'LANScientific')} {String(d.model || '(model TBD)')} ·{' '}
                {String(d.connectionType || 'UNKNOWN')}
              </Text>
            </View>
          ))}
        </AsyncSection>
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
})
