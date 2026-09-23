import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthContext'
import {
  authenticateWithBiometric,
  biometricAvailable,
  getSelectedDepartment,
  getSessionLoginAt,
  isBiometricEnabled,
} from '@/src/auth/sessionPrefs'
import {
  getAssignedManager,
  getAssignedMetalLabels,
  setAssignedMetalLabels,
  type AssignedManager,
} from '@/src/auth/floorDashboardPrefs'
import { fetchHistory } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { tabletDashboard as td } from '@/src/theme'
import { LoginLogoutRow } from './LoginLogoutRow'
import { AssignManagerButton } from './AssignManagerButton'
import { EmployeeTable } from './EmployeeTable'
import { CallFMButton } from './CallFMButton'
import { MetalProcessPanel, type MetalBatchEdit } from './MetalProcessPanel'
import { AssignedMetalInPanel } from './AssignedMetalInPanel'
import { AssignManagerModal } from './AssignManagerModal'
import { CallFMModal } from './CallFMModal'
import { ScaleConfirmModal } from './ScaleConfirmModal'
import {
  buildMetalProcessBatches,
  formatClock,
  type MovementLike,
} from './metalMapping'

const DASH_MIN_WIDTH = 960

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function emptyEditableBatches(): MetalBatchEdit[] {
  return [
    {
      batchLabel: '1',
      lines: [
        { metal: 'Gold', qty: '', purity: '', time: '' },
        { metal: 'Alloy', qty: '', purity: '', time: '' },
      ],
    },
    {
      batchLabel: '2',
      lines: [
        { metal: 'Gold', qty: '', purity: '', time: '' },
        { metal: 'Alloy', qty: '', purity: '', time: '' },
      ],
    },
  ]
}

function toEditable(batches: ReturnType<typeof buildMetalProcessBatches>): MetalBatchEdit[] {
  return batches.map((b) => ({
    batchLabel: b.batchLabel,
    lines: b.lines.map((l: { metal: string; qty: string; purity: string; time: string }) => ({
      metal: l.metal,
      qty: l.qty || '',
      purity: l.purity || '',
      time: l.time || '',
    })),
  }))
}

export function MGFloorTabletDashboard() {
  const { user, token, logout, login } = useAuth()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const compact = width < 900

  const [dept, setDept] = useState('')
  const [loginAt, setLoginAt] = useState<string | null>(null)
  const [manager, setManager] = useState<AssignedManager | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'in' | 'out' | null>(null)
  const [metalInBatches, setMetalInBatches] = useState<MetalBatchEdit[]>(emptyEditableBatches)
  const [metalOutBatches, setMetalOutBatches] = useState<MetalBatchEdit[]>(emptyEditableBatches)
  const [assignedMetal, setAssignedMetal] = useState({ batch1: '', batch2: '' })
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    getSelectedDepartment().then((d) => setDept(d || user?.department || ''))
  }, [user?.department])

  useEffect(() => {
    getAssignedManager().then(setManager)
    getAssignedMetalLabels().then(setAssignedMetal)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoginAt(null)
      return
    }
    getSessionLoginAt().then(setLoginAt)
  }, [token, user?.id])

  const history = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchHistory({ limit: 50, skip: 0, from: startOfToday() }, { signal })
      return (res.movements || []) as MovementLike[]
    }, []),
    { cacheKey: 'mg-floor:dash-history-today', isEmpty: (d) => !d.length },
  )

  useEffect(() => {
    if (seeded || !history.data) return
    setMetalInBatches(toEditable(buildMetalProcessBatches(history.data, 'in')))
    setMetalOutBatches(toEditable(buildMetalProcessBatches(history.data, 'out')))
    setSeeded(true)
  }, [history.data, seeded])

  const employees = useMemo(() => {
    if (!token || !user) return []
    return [
      {
        name: user.name || '—',
        login: formatClock(loginAt),
        logout: '--',
      },
    ]
  }, [token, user, loginAt])

  const onLogin = async () => {
    try {
      const avail = await biometricAvailable()
      const enabled = await isBiometricEnabled()
      if (avail && enabled) {
        const creds = await authenticateWithBiometric()
        if (creds) {
          await login(creds.username, creds.password)
          return
        }
      }
    } catch {
      // fall through to password login
    }
    router.push('/login' as never)
  }

  const onLogout = async () => {
    await logout()
  }

  const onAssignedMetalChange = async (next: { batch1: string; batch2: string }) => {
    setAssignedMetal(next)
    await setAssignedMetalLabels(next)
  }

  const contentWidth = Math.max(width, DASH_MIN_WIDTH)
  const padH = compact ? 8 : 14
  const gap = compact ? 6 : 10

  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator
      contentContainerStyle={{ minWidth: DASH_MIN_WIDTH, flexGrow: 1 }}
      style={styles.hScroll}
    >
      <View style={[styles.root, { width: contentWidth, paddingHorizontal: padH }]}>
        <View style={[styles.blankHeader, compact && { height: 10 }]} />
        <View style={[styles.grid, { gap: 0 }]}>
          <View style={[styles.col, styles.colLeft, { gap }]}>
            <LoginLogoutRow
              onLogin={onLogin}
              onLogout={onLogout}
              loggedIn={Boolean(token)}
              loginDisabled={Boolean(token)}
            />
            <AssignManagerButton onPress={() => setAssignOpen(true)} />
            <EmployeeTable employees={employees} />
            <CallFMButton onPress={() => setCallOpen(true)} />
          </View>

          <View style={styles.divider} />

          <View style={[styles.col, styles.colMid, { gap }]}>
            <MetalProcessPanel
              title="Metal In"
              batches={metalInBatches}
              onChange={setMetalInBatches}
              onConfirm={() => setConfirmKind('in')}
              confirmLabel="Confirm"
              confirmDisabled={!token}
              compact={compact}
            />
          </View>

          <View style={styles.divider} />

          <View style={[styles.col, styles.colRight, { gap }]}>
            <View style={styles.metalOutBlock}>
              <MetalProcessPanel
                title="Metal Out"
                batches={metalOutBatches}
                onChange={setMetalOutBatches}
                onConfirm={() => setConfirmKind('out')}
                confirmLabel="Confirm"
                confirmDisabled={!token}
                compact={compact}
              />
            </View>
            <AssignedMetalInPanel
              batch1={assignedMetal.batch1}
              batch2={assignedMetal.batch2}
              onChange={onAssignedMetalChange}
              compact={compact}
            />
          </View>
        </View>
      </View>

      <AssignManagerModal
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={setManager}
      />
      <CallFMModal
        visible={callOpen}
        onClose={() => setCallOpen(false)}
        department={dept}
        operatorName={user?.name || ''}
        operatorId={user?.id || ''}
        manager={manager}
      />
      <ScaleConfirmModal
        visible={confirmKind != null}
        kind={confirmKind || 'in'}
        batches={confirmKind === 'out' ? metalOutBatches : metalInBatches}
        onClose={() => setConfirmKind(null)}
        onSaved={() => {
          setSeeded(false)
          history.reload()
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  hScroll: { flex: 1, backgroundColor: td.white },
  root: {
    flex: 1,
    backgroundColor: td.white,
    paddingBottom: 12,
  },
  blankHeader: {
    height: 20,
    backgroundColor: td.white,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  col: {
    minWidth: 0,
    minHeight: 0,
  },
  colLeft: { flex: 30 },
  colMid: { flex: 34 },
  colRight: { flex: 36 },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: td.borderLight,
    marginHorizontal: 12,
  },
  metalOutBlock: {
    flex: 1,
    minHeight: 0,
  },
})
