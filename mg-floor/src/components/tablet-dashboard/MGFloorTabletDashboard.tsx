import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { getSelectedDepartment } from '@/src/auth/sessionPrefs'
import { employeeRows } from '@/src/auth/sessionList'
import { EmployeeLoginModal } from './EmployeeLoginModal'
import { getAssignedManager, type AssignedManager } from '@/src/auth/floorDashboardPrefs'
import { tabletDashboard as td } from '@/src/theme'
import { LoginLogoutRow } from './LoginLogoutRow'
import { AssignManagerButton } from './AssignManagerButton'
import { EmployeeTable } from './EmployeeTable'
import { CallFMButton } from './CallFMButton'
import { DepartmentBadge } from './DepartmentBadge'
import { effectiveFloorDepartment, floorDepartmentLabel } from '@/src/config/floorDepartments'
import { MetalProcessPanel, type MetalBatchEdit, type MetalPanelRow } from './MetalProcessPanel'
import { MetalEntryModal } from './MetalEntryModal'
import {
  batchStatusView,
  dayTag,
  editableBatch,
  localDateKey,
  metalOptionsFor,
  metalOutChoices,
  nextBatchLabel,
  sentBatchesFor,
  withDefaultMetals,
  type BatchChoice,
  type SentBatch,
} from './batchEntryMapping'
import { useBatchApprovals } from './useBatchApprovals'
import { useBatchStats } from './useBatchStats'
import { BatchTimeCard, MetalLossCard } from './BatchStatsCards'
import { LossLimitModal } from './LossLimitModal'
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

function panelRows(batches: SentBatch[], direction: BatchDirection): MetalPanelRow[] {
  return batches.map((b) => ({
    batchLabel: b.batchLabel,
    entryDate: b.entryDate,
    dayTag: dayTag(b.entryDate),
    lines: withDefaultMetals(b.lines, direction),
    status: batchStatusView(b.state),
    canFix: b.state.status === 'REJECTED',
  }))
}

export function MGFloorTabletDashboard() {
  const { user, token, permissions, logout, logoutUser, sessions, loggedOut } = useAuth()
  const { width } = useWindowDimensions()
  const compact = width < 900

  const [selectedDept, setSelectedDept] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)
  const [manager, setManager] = useState<AssignedManager | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null)
  const [limitOpen, setLimitOpen] = useState(false)
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

  const approvals = useBatchApprovals({ token, department: dept })
  const metalIn = useMemo(() => sentBatchesFor('IN', approvals.states, approvals.sent), [approvals.states, approvals.sent])
  const metalOut = useMemo(() => sentBatchesFor('OUT', approvals.states, approvals.sent), [approvals.states, approvals.sent])
  const today = localDateKey()
  const approvedKey = useMemo(
    () => Object.entries(approvals.states).filter(([, s]) => s?.status === 'APPROVED').map(([k]) => k).sort().join(','),
    [approvals.states],
  )
  const batchStats = useBatchStats({ token, department: dept, refreshKey: approvedKey })
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
    setEntryForm({ direction, initial: editableBatch(choice, undefined, direction), fixing: false })
  }

  const openFix = (direction: BatchDirection, row: MetalPanelRow) => {
    const batch = (direction === 'IN' ? metalIn : metalOut).find(
      (b) => b.entryDate === row.entryDate && b.batchLabel === row.batchLabel,
    )
    setEntryForm({ direction, initial: editableBatch(row, batch?.lines, direction), fixing: true })
  }

  const employees = useMemo(
    () =>
      employeeRows(sessions, loggedOut).map((row) => ({
        id: row.userId,
        name: row.name || '—',
        login: formatClock(row.loginAt),
        logout: row.logoutAt ? formatClock(row.logoutAt) : '--',
        active: row.active,
      })),
    [sessions, loggedOut],
  )

  const senders = useMemo(() => sessions.map((s) => ({ id: s.user.id, name: s.user.name })), [sessions])
  const operatorNames = sessions.map((s) => s.user.name).join(', ')

  const onLogout = () => {
    if (sessions.length > 1) setConfirmLogoutAll(true)
    else logout().catch(() => {})
  }

  const sendBatch = (direction: BatchDirection, batch: MetalBatchEdit, senderId: string | null) => {
    const sender = sessions.find((s) => s.user.id === senderId)
    return approvals.confirm(direction, batch, sender ? { userId: sender.user.id, token: sender.token } : null)
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
                onLogin={() => setLoginOpen(true)}
                onLogout={onLogout}
                loggedInCount={sessions.length}
              />
              <AssignManagerButton onPress={() => setAssignOpen(true)} />
              <DepartmentBadge department={dept} loggedIn={Boolean(token)} />
              <EmployeeTable employees={employees} onLogout={(id) => logoutUser(id).catch(() => {})} />
              <View style={styles.leftSpacer} />
              <CallFMButton onPress={() => setCallOpen(true)} />
            </View>

            <View style={styles.divider} />

            <View style={[styles.col, styles.colMid, { gap }]}>
              <MetalProcessPanel
                title="Metal In"
                rows={panelRows(metalIn, 'IN')}
                onAdd={() => openNew('IN')}
                onFix={(row) => openFix('IN', row)}
                compact={compact}
              />
              <MetalLossCard
                stats={batchStats.stats}
                today={today}
                canSetLimit={Boolean(batchStats.stats?.canSetLossLimit)}
                onEditLimit={() => setLimitOpen(true)}
              />
            </View>

            <View style={styles.divider} />

            <View style={[styles.col, styles.colRight, { gap }]}>
              <View style={styles.metalOutBlock}>
                <MetalProcessPanel
                  title="Metal Out"
                  rows={panelRows(metalOut, 'OUT')}
                  onAdd={() => openNew('OUT')}
                  onFix={(row) => openFix('OUT', row)}
                  compact={compact}
                />
              </View>
              <BatchTimeCard stats={batchStats.stats} today={today} />
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
        operatorName={operatorNames || user?.name || ''}
        manager={manager}
      />
      {entryForm ? (
        <MetalEntryModal
          visible
          title={entryForm.direction === 'IN' ? 'Metal In' : 'Metal Out'}
          batchOptions={batchOptions}
          initial={entryForm.initial}
          metalOptions={metalOptionsFor(entryForm.direction)}
          canSend={Boolean(token) && Boolean(dept)}
          hint={sendHint}
          senders={senders}
          onSend={(batch, senderId) => sendBatch(entryForm.direction, batch, senderId)}
          onClose={() => setEntryForm(null)}
        />
      ) : null}
      <EmployeeLoginModal visible={loginOpen} onClose={() => setLoginOpen(false)} tabletDepartment={dept} />
      <LossLimitModal
        visible={limitOpen}
        department={floorDepartmentLabel(dept)}
        current={batchStats.stats?.lossLimitPct ?? null}
        onSave={batchStats.setLossLimit}
        onClose={() => setLimitOpen(false)}
      />
      <Modal visible={confirmLogoutAll} transparent animationType="fade" onRequestClose={() => setConfirmLogoutAll(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Logout all {sessions.length} employees?</Text>
            <Text style={styles.confirmBody}>Everyone logged in on this tablet will be logged out.</Text>
            <View style={styles.confirmRow}>
              <Pressable accessibilityRole="button" onPress={() => setConfirmLogoutAll(false)} style={[styles.confirmBtn, styles.confirmCancel]}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setConfirmLogoutAll(false)
                  logout().catch(() => {})
                }}
                style={[styles.confirmBtn, styles.confirmOk]}
              >
                <Text style={styles.confirmOkText}>Logout all</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  metalOutBlock: {},
  leftSpacer: { flex: 1 },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: td.white,
    borderRadius: td.radius,
    borderWidth: 1,
    borderColor: td.border,
    padding: 18,
  },
  confirmTitle: { color: td.text, fontWeight: '800', fontSize: 18 },
  confirmBody: { color: td.textMuted, fontSize: 14, marginTop: 6 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: td.radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancel: { borderColor: td.borderLight, backgroundColor: td.white },
  confirmCancelText: { color: td.text, fontWeight: '700', fontSize: 16 },
  confirmOk: { borderColor: td.orange, backgroundColor: td.orange },
  confirmOkText: { color: td.white, fontWeight: '800', fontSize: 16 },
})
