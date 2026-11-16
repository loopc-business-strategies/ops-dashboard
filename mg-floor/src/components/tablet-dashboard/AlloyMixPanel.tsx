import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { buttonShadow, tabletDashboard as td } from '@/src/theme'
import {
  allocateAlloyMixJob,
  listAlloyMixJobs,
  type AlloyMixJob,
} from '@/src/api/alloyMixJobs'
import { FLOOR_DEPARTMENTS, floorDepartmentLabel } from '@/src/config/floorDepartments'
import { IdleFade } from './IdleFade'

type Props = {
  token: string | null
  department: string
  idle?: boolean
  onIdlePress?: () => void
  /** Bump to force reload (e.g. after FM workbook sync). */
  refreshKey?: string
}

export function AlloyMixPanel({
  token,
  department,
  idle = false,
  onIdlePress,
  refreshKey = '',
}: Props) {
  const [jobs, setJobs] = useState<AlloyMixJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [allocating, setAllocating] = useState<AlloyMixJob | null>(null)

  const load = useCallback(async () => {
    if (!token || !department) {
      setJobs([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await listAlloyMixJobs({ token, department })
      setJobs(Array.isArray(res.jobs) ? res.jobs : [])
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Failed to load mixes')
        : 'Failed to load mixes'
      setError(message)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [token, department])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const destOptions = useMemo(
    () => FLOOR_DEPARTMENTS.filter((d) => d.key !== department),
    [department],
  )

  const onAllocate = async (toDepartment: string) => {
    if (!token || !allocating) return
    setBusyId(allocating.id)
    setError('')
    try {
      await allocateAlloyMixJob({
        token,
        mixId: allocating.id,
        toDepartment,
      })
      setAllocating(null)
      await load()
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Allocate failed')
        : 'Allocate failed'
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
          <ActivityIndicator color={td.accent || '#B45309'} style={{ marginVertical: 12 }} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && jobs.length === 0 ? (
          <Text style={styles.empty}>
            No alloy mix in this department. Post Mix in ERP Gold Alloy lands in Vault Room.
          </Text>
        ) : null}
        <ScrollView style={styles.list} nestedScrollEnabled>
          {jobs.map((job) => (
            <View key={job.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.code}>{job.mixCode}</Text>
                <Text style={styles.karat}>{job.karat}K · {job.targetGross} g</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {job.finishedProductName || 'Alloy'}
              </Text>
              <Text style={styles.meta}>
                {job.status === 'in_vault' ? 'In vault — Update Mix allowed in ERP' : 'On floor'}
                {job.canUpdateMix ? ' · can update' : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Allocate ${job.mixCode}`}
                disabled={Boolean(busyId) || idle}
                onPress={() => (idle ? onIdlePress?.() : setAllocating(job))}
                style={({ pressed }) => [
                  styles.allocBtn,
                  pressed && styles.allocBtnPressed,
                  (busyId === job.id || idle) && styles.allocBtnDisabled,
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
              {allocating?.mixCode} · {allocating?.targetGross} g
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
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
            <Pressable onPress={() => setAllocating(null)} style={styles.cancelBtn}>
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
  body: { padding: 8, flexGrow: 1 },
  list: { maxHeight: 200 },
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
    gap: 8,
  },
  code: { fontWeight: '800', color: '#78350F', fontSize: 13 },
  karat: { fontWeight: '700', color: '#92400E', fontSize: 12 },
  name: { color: '#334155', fontSize: 12, marginTop: 2 },
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
  modalSub: { color: '#64748B', marginBottom: 10, marginTop: 2 },
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
