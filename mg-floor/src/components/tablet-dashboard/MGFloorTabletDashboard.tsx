import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
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
import { DepartmentBadge } from './DepartmentBadge'
import { effectiveFloorDepartment } from '@/src/config/floorDepartments'
import { MetalProcessPanel, type MetalBatchEdit, type PanelApproval } from './MetalProcessPanel'
import { batchKey, batchStatusView, isBatchLocked } from './batchEntryMapping'
import { useBatchApprovals } from './useBatchApprovals'
import type { BatchDirection } from '@/src/api/batchEntries'
import { AssignedMetalInPanel } from './AssignedMetalInPanel'
import { AssignManagerModal } from './AssignManagerModal'
import { CallFMModal } from './CallFMModal'
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
  const { user, token, permissions, logout, login } = useAuth()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const compact = width < 900

  const [selectedDept, setSelectedDept] = useState('')
  const [loginAt, setLoginAt] = useState<string | null>(null)
  const [manager, setManager] = useState<AssignedManager | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [metalInBatches, setMetalInBatches] = useState<MetalBatchEdit[]>(emptyEditableBatches)
  const [metalOutBatches, setMetalOutBatches] = useState<MetalBatchEdit[]>(emptyEditableBatches)
  const [assignedMetal, setAssignedMetal] = useState({ batch1: '', batch2: '' })
  const [seeded, setSeeded] = useState(false)
  const [fullSize, setFullSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    getSelectedDepartment().then((d) => setSelectedDept(d || ''))
  }, [])

  const canChooseDepartment = Boolean(permissions.approveBatches)
  const dept = effectiveFloorDepartment({
    floorDepartment: user?.floorDepartment,
    selectedDepartment: selectedDept,
    canChooseDepartment,
  })

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

  const setBatches = useCallback(
    (direction: BatchDirection, update: (batches: MetalBatchEdit[]) => MetalBatchEdit[]) => {
      if (direction === 'IN') setMetalInBatches(update)
      else setMetalOutBatches(update)
    },
    [],
  )
  const approvals = useBatchApprovals({ token, department: dept, setBatches })
  const { overlay } = approvals

  useEffect(() => {
    if (!history.data || seeded) return
    setMetalInBatches(overlay('IN', toEditable(buildMetalProcessBatches(history.data, 'in'))))
    setMetalOutBatches(overlay('OUT', toEditable(buildMetalProcessBatches(history.data, 'out'))))
    setSeeded(true)
  }, [history.data, seeded, overlay])

  const approvalFor = (direction: BatchDirection, batches: MetalBatchEdit[]): PanelApproval => ({
    rows: Object.fromEntries(
      batches.map((b) => {
        const key = batchKey(direction, b.batchLabel)
        const state = approvals.states[key]
        return [
          b.batchLabel,
          { locked: isBatchLocked(state), busy: approvals.busyKey === key, status: batchStatusView(state) },
        ]
      }),
    ),
    canConfirm: Boolean(token) && Boolean(dept) && !approvals.busyKey,
    hint: !token
      ? 'Log in to send for Floor Manager approval'
      : !dept
        ? 'No floor department is assigned to your account. Ask an admin.'
        : undefined,
    message: approvals.message?.direction === direction ? approvals.message.text : null,
    onConfirm: (batch) => approvals.confirm(direction, batch),
  })

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

  /**
   * The on-screen keyboard shrinks the view; keep the dashboard at its full (keyboard-closed)
   * height so the box being typed in can scroll above the keyboard instead of being squeezed out.
   */
  const onBodyLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    setFullSize((prev) => (prev.width === width && prev.height >= h ? prev : { width, height: h }))
  }
  const fullHeight = fullSize.width === width ? fullSize.height : 0

  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ minWidth: DASH_MIN_WIDTH, flexGrow: 1 }}
      style={styles.hScroll}
    >
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        onLayout={onBodyLayout}
        style={{ width: contentWidth }}
        contentContainerStyle={{ flexGrow: 1, minHeight: fullHeight || undefined }}
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
              <DepartmentBadge department={dept} loggedIn={Boolean(token)} />
              <EmployeeTable employees={employees} />
              <CallFMButton onPress={() => setCallOpen(true)} />
            </View>

            <View style={styles.divider} />

            <View style={[styles.col, styles.colMid, { gap }]}>
              <MetalProcessPanel
                title="Metal In"
                batches={metalInBatches}
                onChange={setMetalInBatches}
                approval={approvalFor('IN', metalInBatches)}
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
                  approval={approvalFor('OUT', metalOutBatches)}
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
      </ScrollView>

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
