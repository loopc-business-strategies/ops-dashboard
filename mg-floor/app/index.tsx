import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, StatusPill, Subtitle, Title, useIsTablet } from '@/src/components/ui'
import { pendingCount } from '@/src/offline/outbox'
import { fetchScales } from '@/src/api/floor'
import { colors, spacing } from '@/src/theme'

export default function HomeScreen() {
  const { user, shift, permissions, logout } = useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const [pending, setPending] = useState(0)
  const [scaleSummary, setScaleSummary] = useState('—')

  useEffect(() => {
    pendingCount().then(setPending)
    fetchScales()
      .then((res) => {
        const scales = res.scales || []
        const connected = scales.filter((s) => ['CONNECTED', 'STABLE', 'UNSTABLE'].includes(String(s.status))).length
        setScaleSummary(`${connected}/${scales.length} online`)
      })
      .catch(() => setScaleSummary('unavailable'))
  }, [])

  const shiftLabel =
    shift && typeof shift === 'object' && shift !== null && 'name' in shift
      ? String((shift as { name?: string }).name || '—')
      : '—'

  const actions = [
    { label: 'METAL IN', href: '/metal-in', show: permissions.metalIn !== false },
    { label: 'METAL OUT', href: '/metal-out', show: permissions.metalOut !== false },
    { label: 'TRANSFER', href: '/transfer', show: permissions.transfer !== false },
    { label: 'SCAN', href: '/scan', show: true },
    { label: 'MY JOBS', href: '/jobs', show: true },
    { label: 'HISTORY', href: '/history', show: true },
    { label: 'XRF / QC', href: '/xrf', show: true },
    { label: 'DEVICES', href: '/devices', show: true },
    { label: 'OFFLINE SYNC', href: '/offline-sync', show: true },
  ]

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Title>MG FLOOR</Title>
        <Subtitle>
          {user?.name || '—'} · {user?.department || 'No dept'} · Shift {shiftLabel}
        </Subtitle>
        <View style={styles.metaRow}>
          <StatusPill label={`SYNC ${pending ? `${pending} PENDING` : 'OK'}`} tone={pending ? 'warn' : 'ok'} />
          <StatusPill label={`SCALES ${scaleSummary}`} tone="neutral" />
          <StatusPill label={String(user?.productionRole || user?.role || '').toUpperCase()} tone="neutral" />
        </View>

        <View style={tablet ? styles.grid : styles.stack}>
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <View key={a.href} style={tablet ? styles.gridItem : undefined}>
                <BigButton label={a.label} onPress={() => router.push(a.href as never)} />
              </View>
            ))}
        </View>

        {permissions.manageScales ? (
          <BigButton label="SCALE MANAGEMENT" onPress={() => router.push('/scales')} tone="neutral" />
        ) : null}
        {permissions.adjustWeight ? (
          <BigButton label="SUPERVISOR CORRECTION" onPress={() => router.push('/correction')} tone="neutral" />
        ) : null}
        <BigButton label="PROFILE / SETTINGS" onPress={() => router.push('/profile')} tone="neutral" />
        <BigButton label="SETTINGS" onPress={() => router.push('/settings')} tone="neutral" />
        <BigButton label="SIGN OUT" onPress={() => logout()} tone="danger" />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  stack: {
    gap: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '48%',
  },
})
