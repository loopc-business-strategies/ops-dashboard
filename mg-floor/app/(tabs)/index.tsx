import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { useAuth } from '@/src/context/AuthContext'
import { BigButton, Screen, StatusPill, useIsTablet } from '@/src/components/ui'
import { ModernGoldLogo } from '@/src/components/ModernGoldLogo'
import { ErrorState, SectionLoading } from '@/src/components/async'
import { MGFloorTabletDashboard } from '@/src/components/tablet-dashboard'
import { fetchHistory, fetchJobs, fetchStatsSummary, callFloorManager } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { getSelectedDepartment } from '@/src/auth/sessionPrefs'
import { brand, colors, spacing } from '@/src/theme'
import { userFacingMessage } from '@/src/api/errors'
import { createOperationId } from '@/src/offline/outbox'

type Job = {
  _id?: string
  batchId?: string
  batchNumber?: string
  metalType?: string
  currentWeight?: number
  expectedWeight?: number
  targetWeight?: number
  status?: string
  currentDepartment?: string
  createdAt?: string
  startedAt?: string
}

type Movement = {
  _id?: string
  batchNumber?: string
  weight?: number
  metalType?: string
  fromDepartment?: string
  toDepartment?: string
  status?: string
  issuedByName?: string
  receivedByName?: string
  createdAt?: string
  purpose?: string
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

export default function HomeScreen() {
  const { user, permissions } = useAuth()
  const router = useRouter()
  const tablet = useIsTablet()
  const { width, height } = useWindowDimensions()
  const landscape = width > height

  // Tablet landscape: exact reference dashboard (replaces old tablet home).
  if (tablet && landscape) {
    return (
      <Screen style={{ padding: 0, backgroundColor: '#FFFFFF' }}>
        <MGFloorTabletDashboard />
      </Screen>
    )
  }

  return <MobileHomeScreen user={user} permissions={permissions} router={router} tablet={tablet} />
}

function MobileHomeScreen({
  user,
  permissions,
  router,
  tablet,
}: {
  user: ReturnType<typeof useAuth>['user']
  permissions: Record<string, boolean>
  router: ReturnType<typeof useRouter>
  tablet: boolean
}) {
  const [dept, setDept] = useState('')
  const [selected, setSelected] = useState<Job | null>(null)
  const [now, setNow] = useState(new Date())
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    getSelectedDepartment().then((d) => setDept(d || user?.department || ''))
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [user?.department])

  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      const list = (Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? (raw as { tasks: unknown[] }).tasks
          : []) as Job[]
      return list
    }, []),
    { cacheKey: 'mg-floor:home-jobs', isEmpty: (d) => !d.length },
  )

  const history = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchHistory({ limit: 20, skip: 0, from: startOfToday() }, { signal })
      return (res.movements || []) as Movement[]
    }, []),
    { cacheKey: 'mg-floor:home-history-today', isEmpty: (d) => !d.length },
  )

  const stats = useAsyncResource(
    useCallback(async (signal) => {
      return fetchStatsSummary({ from: startOfToday() }, { signal })
    }, []),
    { cacheKey: 'mg-floor:home-stats' },
  )

  useEffect(() => {
    if (!selected && jobs.data?.length) setSelected(jobs.data[0])
  }, [jobs.data, selected])

  const previous = history.data?.[0] || null
  const batchId = selected?._id || selected?.batchId || ''

  const callManager = () => {
    Alert.alert('CALL FLOOR MANAGER?', `Department: ${dept || '—'}\nOperator: ${user?.name || '—'}`, [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'CALL',
        onPress: async () => {
          if (calling) return
          setCalling(true)
          try {
            const net = await NetInfo.fetch()
            if (!net.isConnected) {
              Alert.alert('Offline', 'Network unavailable — try again when online.')
              return
            }
            await callFloorManager({
              title: `Floor assistance — ${dept || 'floor'}`,
              message: `Operator ${user?.name || 'unknown'} (${user?.id || ''}) needs assistance.`,
              department: dept || user?.department || '',
              batchId: batchId || undefined,
              batchNumber: selected?.batchNumber || '',
              operationId: createOperationId('floor_alert'),
            })
            Alert.alert('FLOOR MANAGER ALERTED')
          } catch (err) {
            Alert.alert('Call failed', userFacingMessage(err) || 'Unable to raise alert')
          } finally {
            setCalling(false)
          }
        },
      },
    ])
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {!tablet ? <ModernGoldLogo height={36} /> : null}
        <Text style={styles.headerBrand}>{brand.appName}</Text>
        <Text style={styles.headerDept}>{(dept || user?.department || 'FLOOR').toUpperCase()} DEPARTMENT</Text>
        <Text style={styles.headerTime}>
          {now.toLocaleDateString()} · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || '?').slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.opName}>{user?.name || '—'}</Text>
        <Text style={styles.opId}>{user?.id ? `ID ${String(user.id).slice(-6)}` : ''}</Text>
      </View>
    </View>
  )

  const currentBatch = (
    <Card title="CURRENT BATCH">
      {jobs.status === 'loading' && !jobs.data ? <SectionLoading label="Loading batches…" /> : null}
      {jobs.status === 'error' && !jobs.data ? (
        <ErrorState message={jobs.error || 'Unable to load batches'} onRetry={jobs.reload} />
      ) : null}
      {jobs.status === 'empty' ? <Text style={styles.muted}>No batches</Text> : null}
      {selected ? (
        <View>
          <Text style={styles.batchId}>{selected.batchNumber || selected._id || '—'}</Text>
          <Text style={styles.meta}>Material: {selected.metalType || 'Gold'}</Text>
          <Text style={styles.weightBig}>
            {Number(selected.currentWeight ?? selected.targetWeight ?? 0).toFixed(2)} g
          </Text>
          <Text style={styles.meta}>
            Expected: {Number(selected.expectedWeight ?? selected.targetWeight ?? 0).toFixed(2)} g
          </Text>
          <StatusPill label={String(selected.status || '—').toUpperCase()} tone="neutral" />
          <Text style={styles.meta}>Operator: {user?.name || '—'}</Text>
          <BigButton label="CHANGE BATCH" tone="neutral" onPress={() => router.push('/jobs' as never)} />
        </View>
      ) : null}
    </Card>
  )

  const batchList = (
    <Card title="BATCH LIST">
      {(jobs.data || []).slice(0, 12).map((j) => {
        const id = String(j._id || j.batchId || '')
        const active = id && id === String(selected?._id || selected?.batchId || '')
        return (
          <Pressable
            key={id || j.batchNumber}
            onPress={() => setSelected(j)}
            style={[styles.batchRow, active && styles.batchRowActive]}
          >
            <Text style={[styles.batchRowTitle, active && styles.onOrange]}>
              {j.batchNumber || id.slice(-6)}
            </Text>
            <Text style={[styles.meta, active && styles.onOrange]}>
              {j.metalType || 'Gold'} · {Number(j.currentWeight ?? j.targetWeight ?? 0).toFixed(2)} g ·{' '}
              {j.status || '—'}
            </Text>
          </Pressable>
        )
      })}
    </Card>
  )

  const metalPanels = (
    <View>
      <Card title="METAL IN">
        <Text style={styles.meta}>Selected: {selected?.batchNumber || '—'}</Text>
        <Text style={styles.meta}>
          Current: {Number(selected?.currentWeight ?? 0).toFixed(2)} g
        </Text>
        <BigButton
          label="OPEN METAL IN"
          onPress={() =>
            router.push({
              pathname: '/metal-in',
              params: batchId ? { batchId, passId: batchId } : {},
            } as never)
          }
          disabled={permissions.metalIn === false}
        />
      </Card>
      <Card title="METAL OUT">
        <Text style={styles.meta}>Selected: {selected?.batchNumber || '—'}</Text>
        <Text style={styles.meta}>
          Available: {Number(selected?.currentWeight ?? 0).toFixed(2)} g
        </Text>
        <BigButton
          label="OPEN METAL OUT"
          onPress={() =>
            router.push({
              pathname: '/metal-out',
              params: batchId ? { batchId, batchNumber: selected?.batchNumber || '' } : {},
            } as never)
          }
          disabled={permissions.metalOut === false}
        />
      </Card>
    </View>
  )

  const previousCard = (
    <Card title="PREVIOUS TRANSACTION">
      {!previous ? <Text style={styles.muted}>No previous transaction.</Text> : null}
      {previous ? (
        <View>
          <Text style={styles.meta}>
            Type: {previous.status === 'RECEIVED' ? 'Metal In' : 'Metal Out'}
          </Text>
          <Text style={styles.meta}>Batch: {previous.batchNumber || '—'}</Text>
          <Text style={styles.weightBig}>{Number(previous.weight || 0).toFixed(2)} g</Text>
          <Text style={styles.meta}>
            {previous.fromDepartment || '—'} → {previous.toDepartment || '—'}
          </Text>
          <Text style={styles.meta}>
            Operator: {previous.receivedByName || previous.issuedByName || '—'}
          </Text>
          <Text style={styles.meta}>
            {previous.createdAt ? new Date(previous.createdAt).toLocaleString() : ''}
          </Text>
          <BigButton label="VIEW ALL" tone="neutral" onPress={() => router.push('/history' as never)} />
        </View>
      ) : null}
    </Card>
  )

  const averageCard = (
    <Card title="AVERAGE">
      {stats.status === 'loading' && !stats.data ? <SectionLoading label="Loading…" /> : null}
      {stats.data ? (
        <View>
          <Text style={styles.sectionLabel}>Metal IN</Text>
          <Text style={styles.meta}>Transactions: {stats.data.metalIn?.count ?? 0}</Text>
          <Text style={styles.meta}>Total: {Number(stats.data.metalIn?.total || 0).toFixed(2)} g</Text>
          <Text style={styles.meta}>Average: {Number(stats.data.metalIn?.average || 0).toFixed(2)} g</Text>
          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Metal OUT</Text>
          <Text style={styles.meta}>Transactions: {stats.data.metalOut?.count ?? 0}</Text>
          <Text style={styles.meta}>Total: {Number(stats.data.metalOut?.total || 0).toFixed(2)} g</Text>
          <Text style={styles.meta}>Average: {Number(stats.data.metalOut?.average || 0).toFixed(2)} g</Text>
        </View>
      ) : (
        <Text style={styles.muted}>No average data</Text>
      )}
    </Card>
  )

  const managerCard = (
    <Card title="FLOOR MANAGER">
      <Text style={styles.meta}>Need assistance?</Text>
      <BigButton
        label={calling ? 'CALLING…' : 'CALL FLOOR MANAGER'}
        onPress={callManager}
        disabled={calling}
      />
    </Card>
  )

  const historyCard = (
    <Card title="TODAY'S HISTORY">
      {history.status === 'loading' && !history.data ? <SectionLoading label="Loading history…" /> : null}
      {history.status === 'empty' ? <Text style={styles.muted}>No history</Text> : null}
      {(history.data || []).slice(0, 10).map((m) => (
        <View key={String(m._id)} style={styles.histRow}>
          <Text style={styles.histCell}>
            {m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </Text>
          <Text style={styles.histCell}>{m.batchNumber || '—'}</Text>
          <Text style={styles.histCell}>{m.status === 'RECEIVED' ? 'Metal In' : 'Metal Out'}</Text>
          <Text style={styles.histCell}>{Number(m.weight || 0).toFixed(2)} g</Text>
          <Text style={styles.histCell}>{m.receivedByName || m.issuedByName || '—'}</Text>
        </View>
      ))}
    </Card>
  )

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {header}
        {currentBatch}
        {metalPanels}
        {historyCard}
        {averageCard}
        {managerCard}
        {previousCard}
        {batchList}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerRight: { alignItems: 'flex-end', minWidth: 120 },
  headerBrand: { color: colors.onAccent, fontWeight: '900', fontSize: 18 },
  headerDept: { color: colors.onAccent, fontWeight: '700', opacity: 0.95 },
  headerTime: { color: colors.onAccent, fontSize: 12, marginTop: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: colors.accent, fontWeight: '800' },
  opName: { color: colors.onAccent, fontWeight: '800' },
  opId: { color: colors.onAccent, fontSize: 11, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.accent,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  batchId: { color: colors.text, fontWeight: '900', fontSize: 22 },
  weightBig: { color: colors.text, fontWeight: '900', fontSize: 28, marginVertical: 4 },
  meta: { color: colors.textMuted, marginBottom: 4 },
  muted: { color: colors.textMuted },
  batchRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  batchRowActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  batchRowTitle: { color: colors.text, fontWeight: '800' },
  onOrange: { color: colors.onAccent },
  sectionLabel: { color: colors.text, fontWeight: '800', marginBottom: 4 },
  histRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  histCell: { color: colors.text, fontSize: 12, fontWeight: '600', minWidth: 56 },
})
