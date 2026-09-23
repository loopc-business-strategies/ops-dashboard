import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { useAuth } from '@/src/context/AuthContext'
import { getSelectedDepartment, getSessionLoginAt } from '@/src/auth/sessionPrefs'
import { callFloorManager, fetchHistory, fetchJobs } from '@/src/api/floor'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { userFacingMessage } from '@/src/api/errors'
import { createOperationId } from '@/src/offline/outbox'
import { tabletDashboard as td } from '@/src/theme'
import { LoginLogoutRow } from './LoginLogoutRow'
import { AssignManagerButton } from './AssignManagerButton'
import { EmployeeTable } from './EmployeeTable'
import { CallFMButton } from './CallFMButton'
import { MetalProcessPanel } from './MetalProcessPanel'
import { AssignedMetalInPanel } from './AssignedMetalInPanel'
import {
  assignedBatchLabels,
  buildMetalProcessBatches,
  formatClock,
  type JobLike,
  type MovementLike,
} from './metalMapping'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function MGFloorTabletDashboard() {
  const { user, token, logout } = useAuth()
  const router = useRouter()
  const [dept, setDept] = useState('')
  const [calling, setCalling] = useState(false)
  const [loginAt, setLoginAt] = useState<string | null>(null)

  useEffect(() => {
    getSelectedDepartment().then((d) => setDept(d || user?.department || ''))
  }, [user?.department])

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
    { cacheKey: 'mg-floor:tablet-history-today', isEmpty: (d) => !d.length },
  )

  const jobs = useAsyncResource(
    useCallback(async (signal) => {
      const res = await fetchJobs({ signal })
      const raw = res.jobs
      const list = (Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { tasks?: unknown[] })?.tasks)
          ? (raw as { tasks: unknown[] }).tasks
          : []) as JobLike[]
      return list
    }, []),
    { cacheKey: 'mg-floor:tablet-jobs', isEmpty: (d) => !d.length },
  )

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

  const metalInBatches = useMemo(
    () => buildMetalProcessBatches(history.data || [], 'in'),
    [history.data],
  )
  const metalOutBatches = useMemo(
    () => buildMetalProcessBatches(history.data || [], 'out'),
    [history.data],
  )
  const assigned = useMemo(() => assignedBatchLabels(jobs.data || []), [jobs.data])

  const onLogin = () => router.push('/login' as never)
  const onLogout = async () => {
    await logout()
  }

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

  return (
    <View style={styles.root}>
      <View style={styles.blankHeader} />
      <View style={styles.grid}>
        <View style={[styles.col, styles.colLeft]}>
          <LoginLogoutRow
            onLogin={onLogin}
            onLogout={onLogout}
            loginDisabled={Boolean(token)}
            logoutDisabled={!token}
          />
          {/* Assign Manager wiring deferred — UI only for now */}
          <AssignManagerButton onPress={() => {}} />
          <EmployeeTable employees={employees} />
          <CallFMButton onPress={callManager} disabled={calling} label={calling ? 'Calling…' : 'Call F.M'} />
        </View>

        <View style={styles.divider} />

        <View style={[styles.col, styles.colMid]}>
          <MetalProcessPanel
            title="Metal In"
            batches={metalInBatches}
            onHeaderPress={() => router.push('/metal-in' as never)}
          />
        </View>

        <View style={styles.divider} />

        <View style={[styles.col, styles.colRight]}>
          <View style={styles.metalOutBlock}>
            <MetalProcessPanel
              title="Metal Out"
              batches={metalOutBatches}
              onHeaderPress={() => router.push('/metal-out' as never)}
            />
          </View>
          <AssignedMetalInPanel batch1={assigned.batch1} batch2={assigned.batch2} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: td.white,
    paddingHorizontal: 14,
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
    gap: 10,
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

