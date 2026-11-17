import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'
import {
  allocateAlloyMixJob,
  listAlloyMixJobs,
  receiveAlloyMixJob,
  type AlloyMixJob,
} from '@/src/api/alloyMixJobs'
import { FLOOR_DEPARTMENTS, floorDepartmentLabel } from '@/src/config/floorDepartments'
import {
  buildAllocateWeightPayload,
  formatAllocateSuccess,
  formatInputComponents,
  resolveAllocateWeight,
} from './alloyMixAllocate'
import { IdleFade } from './IdleFade'

/** Soft refresh so ERP Post / PD allocate appear without remount (no socket on tablet). */
const MIX_JOBS_POLL_MS = 60000

type Props = {
  token: string | null
  department: string
  idle?: boolean
  onIdlePress?: () => void
  /** Bump to force reload (e.g. after FM workbook sync). */
  refreshKey?: string
  /** Open mixes in this department — used so Metal In/Out can reuse AMX as batch no. */
  onJobsChange?: (jobs: AlloyMixJob[]) => void
  /** After Approve seeds Metal In — refresh batch approval list immediately. */
  onReceiveDone?: () => void
}

export function AlloyMixPanel({
  token,
  department,
  idle = false,
  onIdlePress,
  refreshKey = '',
  onJobsChange,
  onReceiveDone,
}: Props) {
  const [jobs, setJobs] = useState<AlloyMixJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [allocating, setAllocating] = useState<AlloyMixJob | null>(null)
  const [allocWeight, setAllocWeight] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!token || !department) {
      setJobs([])
      return
    }
    const request = ++requestRef.current
    if (!opts?.soft) setLoading(true)
    if (!opts?.soft) setError('')
    try {
      const res = await listAlloyMixJobs({ token, department })
      if (request !== requestRef.current) return
      setJobs(Array.isArray(res.jobs) ? res.jobs : [])
      if (!opts?.soft) setError('')
    } catch (err: unknown) {
      if (request !== requestRef.current) return
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Failed to load mixes')
        : 'Failed to load mixes'
      // Soft poll failures keep the last list so a blip does not blank the panel.
      if (!opts?.soft) {
        setError(message)
        setJobs([])
      }
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [token, department])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const incoming = useMemo(
    () => jobs.filter((j) => j.status === 'pending_receive' || j.pendingReceive),
    [jobs],
  )
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status !== 'pending_receive' && !j.pendingReceive),
    [jobs],
  )

  useEffect(() => {
    // Metal In batch choices only use accepted (in_department / vault) mixes.
    onJobsChange?.(activeJobs)
  }, [activeJobs, onJobsChange])

  useEffect(() => {
    if (!token || !department) return undefined
    const id = setInterval(() => {
      load({ soft: true })
    }, MIX_JOBS_POLL_MS)
    return () => clearInterval(id)
  }, [token, department, load])

  useEffect(() => {
    if (!token || !department) return undefined
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') load({ soft: true })
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [token, department, load])

  useEffect(() => {
    if (!successMsg) return undefined
    const id = setTimeout(() => setSuccessMsg(''), 3500)
    return () => clearTimeout(id)
  }, [successMsg])

  const destOptions = useMemo(
    () => FLOOR_DEPARTMENTS.filter((d) => d.key !== department),
    [department],
  )

  const openAllocate = (job: AlloyMixJob) => {
    setAllocating(job)
    setAllocWeight(String(job.targetGross ?? ''))
    setSuccessMsg('')
    setError('')
  }

  const onAllocate = async (toDepartment: string) => {
    if (!token || !allocating) return
    const { available, weight, error: weightError } = resolveAllocateWeight(
      allocating.targetGross,
      allocWeight,
    )
    if (weightError) {
      setError(weightError)
      return
    }
    const fromCode = allocating.mixCode
    const destLabel = floorDepartmentLabel(toDepartment) || toDepartment
    setBusyId(allocating.id)
    setError('')
    try {
      const res = await allocateAlloyMixJob({
        token,
        mixId: allocating.id,
        toDepartment,
        ...buildAllocateWeightPayload(available, weight),
      })
      setAllocating(null)
      setAllocWeight('')
      await load({ soft: true })
      setSuccessMsg(formatAllocateSuccess({
        partial: res.partial,
        pendingReceive: res.pendingReceive ?? res.job?.pendingReceive ?? res.job?.status === 'pending_receive',
        fromCode,
        destLabel,
        weight,
        childMixCode: res.childJob?.mixCode,
        parentRemaining: res.parentJob?.targetGross,
      }))
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Allocate failed')
        : 'Allocate failed'
      setError(message)
    } finally {
      setBusyId('')
    }
  }

  const onReceive = async (job: AlloyMixJob, decision: 'APPROVED' | 'REJECTED') => {
    if (!token) return
    if (idle) {
      onIdlePress?.()
      return
    }
    setBusyId(job.id)
    setError('')
    try {
      const res = await receiveAlloyMixJob({ token, mixId: job.id, decision })
      await load({ soft: true })
      if (decision === 'APPROVED') onReceiveDone?.()
      setSuccessMsg(
        decision === 'APPROVED'
          ? `Approved ${res.job.mixCode} — Metal In queued for F.M`
          : `Rejected ${job.mixCode} — returned to ${floorDepartmentLabel(job.pendingFromDepartment) || 'Vault Room'}`,
      )
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Receive failed')
        : 'Receive failed'
      setError(message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, idle && styles.headerIdle]}>
        <Text style={styles.headerText}>Alloy Mix</Text>
        <Text style={styles.headerSub}>
          {floorDepartmentLabel(department) || 'Department'}
        </Text>
      </View>
      <IdleFade idle={idle} style={styles.body}>
        {loading ? (
          <ActivityIndicator color={td.orange} style={{ marginVertical: 12 }} />
        ) : null}
        {successMsg ? (
          <Pressable accessibilityRole="button" onPress={() => setSuccessMsg('')} style={styles.successBanner}>
            <Text style={styles.successText}>{successMsg}</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {incoming.length ? (
          <View style={styles.incomingBlock}>
            <Text style={styles.incomingTitle}>Incoming — Approve or Reject</Text>
            {incoming.map((job) => (
              <View key={`in-${job.id}`} style={styles.incomingCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.code} numberOfLines={2}>{job.mixCode}</Text>
                  <Text style={styles.karat} numberOfLines={1}>
                    {job.karat}K · {job.targetGross} g
                  </Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {job.finishedProductName || 'Alloy'}
                </Text>
                {formatInputComponents(job.inputComponents) ? (
                  <Text style={styles.inputs} numberOfLines={4}>
                    {formatInputComponents(job.inputComponents)}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  From {floorDepartmentLabel(job.pendingFromDepartment) || 'Vault Room'} · waiting
                </Text>
                <View style={styles.receiveRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Approve ${job.mixCode}`}
                    disabled={Boolean(busyId) || idle}
                    onPress={() => onReceive(job, 'APPROVED')}
                    style={({ pressed }) => [
                      styles.approveBtn,
                      pressed && styles.allocBtnPressed,
                      (busyId === job.id || idle) && styles.allocBtnDisabled,
                    ]}
                  >
                    <Text style={styles.allocBtnText}>
                      {busyId === job.id ? '…' : 'Approve'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${job.mixCode}`}
                    disabled={Boolean(busyId) || idle}
                    onPress={() => onReceive(job, 'REJECTED')}
                    style={({ pressed }) => [
                      styles.rejectBtn,
                      pressed && styles.allocBtnPressed,
                      (busyId === job.id || idle) && styles.allocBtnDisabled,
                    ]}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {!loading && incoming.length === 0 && activeJobs.length === 0 ? (
          <Text style={styles.empty}>
            No alloy mix in this department. Post Mix in ERP Gold Alloy lands in Vault Room.
          </Text>
        ) : null}
        <ScrollView style={styles.list} nestedScrollEnabled>
          {activeJobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.code} numberOfLines={2}>
                  {job.mixCode}
                </Text>
                <Text style={styles.karat} numberOfLines={1}>
                  {job.karat}K · {job.targetGross} g
                </Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {job.finishedProductName || 'Alloy'}
              </Text>
              {formatInputComponents(job.inputComponents) ? (
                <Text style={styles.inputs} numberOfLines={4}>
                  {formatInputComponents(job.inputComponents)}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                {job.hasOpenFloorDescendants
                  ? (job.status === 'in_vault'
                    ? 'In vault — split still on floor (ERP update blocked)'
                    : 'On floor — split still open (ERP update blocked)')
                  : job.canUpdateMix
                    ? 'In vault — Update Mix allowed in ERP · can update'
                    : job.status === 'in_vault'
                      ? 'In vault'
                      : 'On floor'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Allocate ${job.mixCode}`}
                disabled={Boolean(busyId) || idle || job.canAllocate === false}
                onPress={() => (idle ? onIdlePress?.() : openAllocate(job))}
                style={({ pressed }) => [
                  styles.allocBtn,
                  pressed && styles.allocBtnPressed,
                  (busyId === job.id || idle || job.canAllocate === false) && styles.allocBtnDisabled,
                ]}
              >
                <Text style={styles.allocBtnText}>
                  {busyId === job.id ? 'Allocating…' : 'Allocate to'}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </IdleFade>

      <Modal
        visible={Boolean(allocating)}
        transparent
        animationType="fade"
        onRequestClose={() => setAllocating(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAllocating(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Allocate to</Text>
            <Text style={styles.modalSub}>
              {allocating?.mixCode} · available {allocating?.targetGross} g
            </Text>
            {formatInputComponents(allocating?.inputComponents) ? (
              <Text style={styles.modalInputs}>
                Inputs: {formatInputComponents(allocating?.inputComponents)}
              </Text>
            ) : null}
            <Text style={styles.weightLabel}>Weight (g) — less than available splits a new mix</Text>
            <TextInput
              value={allocWeight}
              onChangeText={setAllocWeight}
              keyboardType="decimal-pad"
              placeholder={String(allocating?.targetGross ?? '')}
              style={styles.weightInput}
            />
            <ScrollView style={{ maxHeight: 280 }}>
              {destOptions.map((d) => (
                <Pressable
                  key={d.key}
                  accessibilityRole="button"
                  onPress={() => onAllocate(d.key)}
                  style={({ pressed }) => [
                    styles.destRow,
                    pressed && styles.destRowPressed,
                  ]}
                >
                  <Text style={styles.destText}>{d.label}</Text>
                  {d.key === 'vault_room' ? (
                    <Text style={styles.destHint}>Update Mix unlocks</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => {
                setAllocating(null)
                setAllocWeight('')
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: td.border || '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    minHeight: 160,
  },
  header: {
    backgroundColor: '#92400E',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerIdle: { opacity: 0.55 },
  headerText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  headerSub: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  body: { padding: 8, flex: 1, minHeight: 0 },
  list: { flex: 1, minHeight: 0 },
  empty: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 8,
  },
  error: {
    color: '#991B1B',
    fontSize: 12,
    marginBottom: 6,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 8,
  },
  successText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  incomingBlock: { marginBottom: 8 },
  incomingTitle: {
    color: '#9A3412',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  incomingCard: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  receiveRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  approveBtn: {
    flex: 1,
    backgroundColor: '#15803D',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    ...buttonShadow,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#B91C1C',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  code: {
    flex: 1,
    minWidth: 0,
    fontWeight: '800',
    color: '#78350F',
    fontSize: 12,
    lineHeight: 15,
  },
  karat: {
    flexShrink: 0,
    fontWeight: '700',
    color: '#92400E',
    fontSize: 12,
  },
  name: { color: '#334155', fontSize: 12, marginTop: 2 },
  inputs: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 15,
  },
  meta: { color: '#64748B', fontSize: 11, marginTop: 2, marginBottom: 6 },
  allocBtn: {
    backgroundColor: '#B45309',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    ...buttonShadow,
  },
  allocBtnPressed: { opacity: 0.85 },
  allocBtnDisabled: { opacity: 0.5 },
  allocBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub: { color: '#64748B', marginBottom: 4, marginTop: 2 },
  modalInputs: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 8,
  },
  weightLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  weightInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  destRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destRowPressed: { backgroundColor: '#FFFBEB' },
  destText: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  destHint: { fontSize: 11, color: '#B45309', fontWeight: '600' },
  cancelBtn: { marginTop: 10, alignItems: 'center', padding: 10 },
  cancelText: { fontWeight: '700', color: '#64748B' },
})
