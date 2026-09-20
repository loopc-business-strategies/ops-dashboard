import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, StatusPill, Subtitle, Title, useIsTablet } from '@/src/components/ui'
import {
  AsyncSection,
  ConnectionStatus,
  ErrorState,
  LastUpdated,
  SectionLoading,
} from '@/src/components/async'
import { pendingCount } from '@/src/offline/outbox'
import { fetchJobs, fetchScaleSummary } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { colors, spacing } from '@/src/theme'

export default function HomeScreen() {
  const { user, shift, permissions, logout } = useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const [netStatus, setNetStatus] = useState<'ONLINE' | 'OFFLINE' | 'RECONNECTING'>('ONLINE')
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) setNetStatus('OFFLINE')
      else if (state.isInternetReachable === false) setNetStatus('RECONNECTING')
      else setNetStatus('ONLINE')
    })
    pendingCount().then(setPending).catch(() => setPending(0))
    return () => unsub()
  }, [])

  const scales = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchScaleSummary({ signal })
      return res
    }, []),
    {
      cacheKey: 'mg-floor:home-scales',
      isEmpty: (d) => !d.scales?.length,
    },
  )

  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? ((raw as { tasks: unknown[] }).tasks as unknown[])
          : []
      return list
    }, []),
    {
      cacheKey: 'mg-floor:home-jobs',
      isEmpty: (d) => !d.length,
    },
  )

  const shiftLabel =
    shift && typeof shift === 'object' && shift !== null && 'name' in shift
      ? String((shift as { name?: string }).name || '—')
      : '—'

  const scaleList = scales.data?.scales || []
  const online = scaleList.filter((s) =>
    ['CONNECTED', 'STABLE', 'UNSTABLE', 'READY'].includes(String(s.status || '').toUpperCase()),
  ).length
  const total = scales.data?.total ?? scaleList.length

  let scaleSummaryNode: ReactNode
  if (scales.status === 'loading' && !scales.data) {
    scaleSummaryNode = <SectionLoading label="Scale summary…" />
  } else if (scales.status === 'error' && !scales.data) {
    scaleSummaryNode = (
      <ErrorState message="STATUS UNAVAILABLE — Backend connection failed" onRetry={scales.reload} />
    )
  } else if (scales.status === 'empty') {
    scaleSummaryNode = <Text style={styles.muted}>No scales registered</Text>
  } else if (scaleList.length) {
    const offlineCount = Math.max(0, total - online)
    scaleSummaryNode = (
      <View>
        <Text style={styles.summaryLine}>
          {total} SCALES · {online} ONLINE · {offlineCount} OFFLINE
        </Text>
        <LastUpdated at={scales.updatedAt} fromCache={scales.fromCache} />
      </View>
    )
  } else {
    scaleSummaryNode = <SectionLoading label="Scale summary…" />
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Title>MG FLOOR</Title>
        <Subtitle>
          {user?.name || '—'} · {user?.department || 'No dept'} · Shift {shiftLabel}
        </Subtitle>
        <View style={styles.metaRow}>
          <ConnectionStatus status={netStatus} />
          <StatusPill label={`SYNC ${pending ? `${pending} PENDING` : 'OK'}`} tone={pending ? 'warn' : 'ok'} />
          <StatusPill label={String(user?.productionRole || user?.role || '').toUpperCase()} tone="neutral" />
        </View>

        <Text style={styles.section}>PRODUCTION SUMMARY</Text>
        <AsyncSection
          status={jobs.status}
          loadingLabel="Loading jobs…"
          error={jobs.error}
          emptyMessage="No jobs assigned"
          updatedAt={jobs.updatedAt}
          fromCache={jobs.fromCache}
          onRetry={jobs.reload}
        >
          {jobs.data ? <Text style={styles.summaryLine}>{jobs.data.length} job(s)</Text> : null}
        </AsyncSection>

        <Text style={styles.section}>SCALE SUMMARY</Text>
        {scaleSummaryNode}

        {!tablet ? (
          <View style={styles.stack}>
            <BigButton label="METAL IN" onPress={() => router.replace('/metal-in')} />
            <BigButton label="METAL OUT" onPress={() => router.replace('/metal-out')} />
            <BigButton label="TRANSFER" onPress={() => router.replace('/transfer')} />
            <BigButton label="XRF / QC" onPress={() => router.replace('/xrf')} />
            <BigButton label="DEVICES" onPress={() => router.replace('/devices')} tone="neutral" />
            <BigButton label="OFFLINE SYNC" onPress={() => router.replace('/offline-sync')} tone="neutral" />
          </View>
        ) : (
          <Text style={styles.muted}>Use the sidebar to open production and device screens.</Text>
        )}

        {permissions.manageScales ? (
          <BigButton label="SCALE MANAGEMENT" onPress={() => router.replace('/scales')} tone="neutral" />
        ) : null}
        {permissions.adjustWeight ? (
          <BigButton label="SUPERVISOR CORRECTION" onPress={() => router.replace('/correction')} tone="neutral" />
        ) : null}
        <BigButton label="PROFILE / SETTINGS" onPress={() => router.replace('/profile')} tone="neutral" />
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
  section: {
    color: colors.accent,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryLine: { color: colors.text, fontWeight: '700', fontSize: 16 },
  muted: { color: colors.textMuted, marginVertical: spacing.sm },
  stack: { marginTop: spacing.lg },
})
