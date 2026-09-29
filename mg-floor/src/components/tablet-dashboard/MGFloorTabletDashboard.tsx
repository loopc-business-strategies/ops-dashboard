import React, { useEffect, useMemo, useState } from 'react'
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
import { getAssignedManager, type AssignedManager } from '@/src/auth/floorDashboardPrefs'
import { tabletDashboard as td } from '@/src/theme'
import { LoginLogoutRow } from './LoginLogoutRow'
import { AssignManagerButton } from './AssignManagerButton'
import { EmployeeTable } from './EmployeeTable'
import { CallFMButton } from './CallFMButton'
import { DepartmentBadge } from './DepartmentBadge'
import { effectiveFloorDepartment } from '@/src/config/floorDepartments'
import { MetalProcessPanel, type MetalBatchEdit, type MetalPanelRow } from './MetalProcessPanel'
import { MetalEntryModal } from './MetalEntryModal'
import {
  batchStatusView,
  dayTag,
  editableBatch,
  localDateKey,
  metalOutChoices,
  nextBatchLabel,
  sentBatchesFor,
  withDefaultMetals,
  type BatchChoice,
  type SentBatch,
} from './batchEntryMapping'
import { useBatchApprovals } from './useBatchApprovals'
import type { BatchDirection } from '@/src/api/batchEntries'
import { AssignManagerModal } from './AssignManagerModal'
import { CallFMModal } from './CallFMModal'
import { formatClock } from './metalMapping'

const DASH_MIN_WIDTH = 960

/** Open Metal In / Out popup: a new batch, or a rejected batch being fixed. */
type EntryForm = {
  direction: BatchDirection
  initial: MetalBatchEdit
  fixing: boolean
}

function panelRows(batches: SentBatch[]): MetalPanelRow[] {
  return batches.map((b) => ({
    batchLabel: b.batchLabel,
    entryDate: b.entryDate,
    dayTag: dayTag(b.entryDate),
    lines: withDefaultMetals(b.lines),
    status: batchStatusView(b.state),
    canFix: b.state.status === 'REJECTED',
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
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null)
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
  }, [])

  useEffect(() => {
    if (!token) {
      setLoginAt(null)
      return
    }
    getSessionLoginAt().then(setLoginAt)
  }, [token, user?.id])

  const approvals = useBatchApprovals({ token, department: dept })
  const metalIn = useMemo(() => sentBatchesFor('IN', approvals.states, approvals.sent), [approvals.states, approvals.sent])
  const metalOut = useMemo(() => sentBatchesFor('OUT', approvals.states, approvals.sent), [approvals.states, approvals.sent])
  const today = localDateKey()
  const nextIn = useMemo<BatchChoice>(
    () => ({ entryDate: today, batchLabel: nextBatchLabel(metalIn.filter((b) => b.entryDate === today).map((b) => b.batchLabel)) }),
    [metalIn, today],
  )

  const batchOptions = useMemo((): BatchChoice[] => {
    if (!entryForm) return []
    if (entryForm.fixing) {
      return [{ entryDate: entryForm.initial.entryDate || today, batchLabel: entryForm.initial.batchLabel }]
    }
    return entryForm.direction === 'IN' ? [nextIn] : metalOutChoices(metalIn, metalOut, today)
  }, [entryForm, nextIn, metalIn, metalOut, today])

  const sendHint = !token
    ? 'Log in to send for Floor Manager approval'
    : !dept
      ? 'No floor department is assigned to your account. Ask an admin.'
      : undefined

  const openNew = (direction: BatchDirection) => {
    const choice = direction === 'IN' ? nextIn : metalOutChoices(metalIn, metalOut, today)[0]
    setEntryForm({ direction, initial: editableBatch(choice), fixing: false })
  }

  const openFix = (direction: BatchDirection, row: MetalPanelRow) => {
    const batch = (direction === 'IN' ? metalIn : metalOut).find(
      (b) => b.entryDate === row.entryDate && b.batchLabel === row.batchLabel,
    )
    setEntryForm({ direction, initial: editableBatch(row, batch?.lines), fixing: true })
  }

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
                rows={panelRows(metalIn)}
                onAdd={() => openNew('IN')}
                onFix={(row) => openFix('IN', row)}
                compact={compact}
              />
            </View>

            <View style={styles.divider} />

            <View style={[styles.col, styles.colRight, { gap }]}>
              <View style={styles.metalOutBlock}>
                <MetalProcessPanel
                  title="Metal Out"
                  rows={panelRows(metalOut)}
                  onAdd={() => openNew('OUT')}
                  onFix={(row) => openFix('OUT', row)}
                  compact={compact}
                />
              </View>
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
      {entryForm ? (
        <MetalEntryModal
          visible
          title={entryForm.direction === 'IN' ? 'Metal In' : 'Metal Out'}
          batchOptions={batchOptions}
          initial={entryForm.initial}
          canSend={Boolean(token) && Boolean(dept)}
          hint={sendHint}
          onSend={(batch) => approvals.confirm(entryForm.direction, batch)}
          onClose={() => setEntryForm(null)}
        />
      ) : null}
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
