import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import {
  fetchAllTransactions,
  type TransactionRow,
  type TransactionSummary,
} from '@/src/api/transactions'
import { fetchAccountsForLedger, type AccountListItem } from '@/src/api/erpReports'
import DateField from '@/src/components/common/DateField'
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_CHIPS,
  chipToApiType,
  apiTypeToLabel,
} from '@/src/constants/transactionTypes'
import { canAccessTransactions } from '@/src/utils/erpSubTabPermissions'
import { normalizeDateInput, validateDateRange } from '@/src/utils/dateInput'
import {
  filterTransactionsByAccount,
  getTransactionDescription,
  getTransactionPartyLabel,
} from '@/src/utils/transactionFilters'

const EMPTY_SUMMARY: TransactionSummary = {
  totalCount: 0,
  totalAmount: 0,
  draft: 0,
  submitted: 0,
  approved: 0,
  posted: 0,
  returned: 0,
  rejected: 0,
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#FEF3C7', text: '#92400E' },
  submitted: { bg: '#DBEAFE', text: '#1D4ED8' },
  approved: { bg: '#D1FAE5', text: '#065F46' },
  posted: { bg: '#DCFCE7', text: '#166534' },
  returned: { bg: '#FCE7F3', text: '#9D174D' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C' },
}

type FilterState = {
  search: string
  status: string
  typeChip: string
  startDate: string
  endDate: string
  accountCode: string
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  typeChip: '',
  startDate: '',
  endDate: '',
  accountCode: '',
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipLabel}>{label}</Text>
      <Text style={styles.summaryChipValue}>{value.toLocaleString()}</Text>
    </View>
  )
}

function hasActiveFilters(filters: FilterState): boolean {
  return Boolean(
    filters.search.trim() ||
      filters.status ||
      filters.typeChip ||
      filters.startDate.trim() ||
      filters.endDate.trim() ||
      filters.accountCode,
  )
}

function buildApiParams(filters: FilterState) {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    type: chipToApiType(filters.typeChip),
    startDate: normalizeDateInput(filters.startDate) || undefined,
    endDate: normalizeDateInput(filters.endDate) || undefined,
  }
}

export default function TransactionsScreen() {
  const { token, user } = useAuth()
  const { companyCode, branding } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const styles = useMemo(() => createTransactionStyles(branding), [branding])
  const allowed = canAccessTransactions(user)

  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [summary, setSummary] = useState<TransactionSummary>(EMPTY_SUMMARY)
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [listCapped, setListCapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<TransactionRow | null>(null)
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token || !allowed || !sessionReady) return
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError('')

      const rangeCheck = validateDateRange(appliedFilters.startDate, appliedFilters.endDate)
      if (!rangeCheck.ok) {
        setError(rangeCheck.message)
        setLoading(false)
        setRefreshing(false)
        return
      }

      try {
        const data = await fetchAllTransactions(token, buildApiParams(appliedFilters))
        setSummary(data.summary || EMPTY_SUMMARY)
        setListCapped(Boolean(data.capped))
        setRows(data.transactions || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions')
        setRows([])
        setListCapped(false)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [token, allowed, sessionReady, appliedFilters],
  )

  useEffect(() => {
    if (!token || !allowed || !sessionReady) {
      if (!sessionReady) return
      setLoading(false)
      return
    }
    void load('initial')
  }, [token, allowed, sessionReady, companyCode, appliedFilters, load])

  useEffect(() => {
    setRows([])
    setSummary(EMPTY_SUMMARY)
    setListCapped(false)
    setError('')
    setLoading(true)
  }, [companyCode])

  useEffect(() => {
    if (!token || !allowed || !sessionReady) return
    void fetchAccountsForLedger(token)
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
  }, [token, allowed, sessionReady])

  const displayRows = useMemo(
    () => filterTransactionsByAccount(rows, appliedFilters.accountCode),
    [rows, appliedFilters.accountCode],
  )

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        String(a.accountCode || '').toLowerCase().includes(q) ||
        String(a.accountName || '').toLowerCase().includes(q),
    )
  }, [accounts, accountSearch])

  const applyDraftFilters = () => {
    const rangeCheck = validateDateRange(draftFilters.startDate, draftFilters.endDate)
    if (!rangeCheck.ok) {
      setError(rangeCheck.message)
      return
    }
    setError('')
    setAppliedFilters({
      ...draftFilters,
      startDate: normalizeDateInput(draftFilters.startDate),
      endDate: normalizeDateInput(draftFilters.endDate),
    })
  }

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setError('')
  }

  const setTypeChip = (typeChip: string) => {
    setDraftFilters((p) => ({ ...p, typeChip }))
    setAppliedFilters((p) => ({ ...p, typeChip }))
    setError('')
  }

  const setStatus = (status: string) => {
    setDraftFilters((p) => ({ ...p, status }))
    setAppliedFilters((p) => ({ ...p, status }))
    setError('')
  }

  const selectedAccountLabel = useMemo(() => {
    if (!draftFilters.accountCode) return 'All accounts'
    const acc = accounts.find((a) => a.accountCode === draftFilters.accountCode)
    return acc ? `${acc.accountCode} — ${acc.accountName}` : draftFilters.accountCode
  }, [draftFilters.accountCode, accounts])

  const filtersActive = hasActiveFilters(appliedFilters)
  const accountFilterActive = Boolean(appliedFilters.accountCode)

  if (!allowed) {
    return (
      <View style={styles.denied}>
        <Text style={styles.deniedTitle}>Transactions unavailable</Text>
        <Text style={styles.deniedText}>Your role does not include access to ERP transactions.</Text>
      </View>
    )
  }

  if ((!sessionReady || loading) && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryScroll}
        contentContainerStyle={styles.summaryRow}
      >
        <SummaryChip label="Total" value={Number(summary.totalCount || 0)} />
        <SummaryChip label="Draft" value={Number(summary.draft || 0)} />
        <SummaryChip label="Submitted" value={Number(summary.submitted || 0)} />
        <SummaryChip label="Approved" value={Number(summary.approved || 0)} />
        <SummaryChip label="Posted" value={Number(summary.posted || 0)} />
        <SummaryChip label="Returned" value={Number(summary.returned || 0)} />
        <SummaryChip label="Rejected" value={Number(summary.rejected || 0)} />
      </ScrollView>

      {filtersActive ? (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersText}>Filters active</Text>
          <Pressable onPress={resetFilters}>
            <Text style={styles.activeFiltersClear}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.chipsSection}>
        <Text style={styles.sectionLabel}>Transaction type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Pressable
            style={[styles.chip, !appliedFilters.typeChip && styles.chipActive]}
            onPress={() => setTypeChip('')}
          >
            <Text style={[styles.chipText, !appliedFilters.typeChip && styles.chipTextActive]}>All</Text>
          </Pressable>
          {TRANSACTION_TYPE_CHIPS.map(({ chip, label }) => (
            <Pressable
              key={chip}
              style={[styles.chip, appliedFilters.typeChip === chip && styles.chipActive]}
              onPress={() => setTypeChip(chip)}
            >
              <Text style={[styles.chipText, appliedFilters.typeChip === chip && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filtersCard}>
        <TextInput
          style={styles.input}
          placeholder="Search narration, party, voucher, currency…"
            placeholderTextColor={branding.colors.muted}
          value={draftFilters.search}
          onChangeText={(search) => setDraftFilters((p) => ({ ...p, search }))}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {TRANSACTION_STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value || 'all'}
              style={[styles.chip, appliedFilters.status === opt.value && styles.chipActive]}
              onPress={() => setStatus(opt.value)}
            >
              <Text style={[styles.chipText, appliedFilters.status === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.dateRow}>
          <DateField
            label="From date"
            value={draftFilters.startDate}
            onChange={(startDate) => setDraftFilters((p) => ({ ...p, startDate }))}
          />
          <DateField
            label="To date"
            value={draftFilters.endDate}
            onChange={(endDate) => setDraftFilters((p) => ({ ...p, endDate }))}
          />
        </View>
        <Pressable style={styles.accountPicker} onPress={() => setShowAccountPicker(true)}>
          <Text style={styles.accountPickerLabel}>Account</Text>
          <Text style={styles.accountPickerValue} numberOfLines={1}>
            {selectedAccountLabel}
          </Text>
        </Pressable>
        <View style={styles.filterActions}>
          <Pressable style={styles.applyBtn} onPress={applyDraftFilters}>
            <Text style={styles.applyBtnText}>Apply filters</Text>
          </Pressable>
          <Pressable style={styles.resetBtn} onPress={resetFilters}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        </View>
      </View>

      {accountFilterActive ? (
        <Text style={styles.accountNote}>
          Showing {displayRows.length.toLocaleString()} of {rows.length.toLocaleString()} loaded entries for
          account {appliedFilters.accountCode} (account filter is client-side).
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={displayRows}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No transactions match your filters.</Text>}
        ListFooterComponent={
          listCapped ? (
            <Text style={styles.cappedNote}>
              Showing first 500 transactions. Narrow filters to see a specific subset.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const status = String(item.status || '').toLowerCase()
          const statusStyle = STATUS_COLORS[status] || { bg: '#E5E7EB', text: branding.colors.text }
          return (
            <Pressable style={styles.card} onPress={() => setSelected(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>
                  {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>{status || '—'}</Text>
                </View>
              </View>
              <Text style={styles.cardType}>{apiTypeToLabel(String(item.type || ''))}</Text>
              <Text style={styles.cardParty} numberOfLines={1}>
                {getTransactionPartyLabel(item)}
              </Text>
              <Text style={styles.cardAmount}>
                {item.currency || 'USD'}{' '}
                {Number(item.amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {getTransactionDescription(item)}
              </Text>
            </Pressable>
          )
        }}
      />

      <Modal visible={showAccountPicker} animationType="slide" transparent onRequestClose={() => setShowAccountPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAccountPicker(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Filter by account</Text>
            <TextInput
              style={styles.input}
              placeholder="Search accounts…"
              value={accountSearch}
              onChangeText={setAccountSearch}
            />
            <FlatList
              data={[{ _id: '', accountCode: '', accountName: 'All accounts' }, ...filteredAccounts]}
              keyExtractor={(item) => item._id || 'all'}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.accountRow}
                  onPress={() => {
                    const accountCode = item.accountCode || ''
                    setDraftFilters((p) => ({ ...p, accountCode }))
                    setAppliedFilters((p) => ({ ...p, accountCode }))
                    setShowAccountPicker(false)
                    setAccountSearch('')
                  }}
                >
                  <Text style={styles.accountRowCode}>{item.accountCode || '—'}</Text>
                  <Text style={styles.accountRowName} numberOfLines={1}>
                    {item.accountName || 'All accounts'}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>{apiTypeToLabel(String(selected.type || ''))}</Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Status: </Text>
                  {selected.status}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Date: </Text>
                  {selected.date ? new Date(selected.date).toLocaleString() : '—'}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Amount: </Text>
                  {selected.currency} {Number(selected.amount || 0).toLocaleString()}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Party: </Text>
                  {getTransactionPartyLabel(selected)}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Description: </Text>
                  {getTransactionDescription(selected)}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Debit: </Text>
                  {selected.debitAccountId
                    ? `${selected.debitAccountId.accountCode} — ${selected.debitAccountId.accountName}`
                    : '—'}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Credit: </Text>
                  {selected.creditAccountId
                    ? `${selected.creditAccountId.accountCode} — ${selected.creditAccountId.accountName}`
                    : '—'}
                </Text>
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Attachments: </Text>
                  {(selected.attachments || []).length}
                </Text>
                <Pressable style={styles.resetBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.resetBtnText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function createTransactionStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: b.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  denied: { flex: 1, padding: 24, justifyContent: 'center' },
  deniedTitle: { fontSize: 18, fontWeight: '700', color: b.colors.text, marginBottom: 8 },
  deniedText: { fontSize: 14, color: b.colors.muted },
  summaryScroll: { maxHeight: 72, flexGrow: 0 },
  summaryRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  summaryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
  },
  summaryChipLabel: { fontSize: 10, fontWeight: '700', color: b.colors.muted, textTransform: 'uppercase' },
  summaryChipValue: { fontSize: 16, fontWeight: '800', color: b.colors.text, marginTop: 2 },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  activeFiltersText: { fontSize: 12, fontWeight: '700', color: b.colors.muted },
  activeFiltersClear: { fontSize: 12, fontWeight: '700', color: b.colors.primary },
  chipsSection: { paddingHorizontal: 12, paddingBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: b.colors.muted, marginBottom: 6 },
  chipsRow: { gap: 8, paddingRight: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: b.colors.primary, borderColor: b.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: b.colors.text },
  chipTextActive: { color: '#FFFFFF' },
  filtersCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: b.colors.text,
    backgroundColor: '#FAFAFA',
  },
  dateRow: { flexDirection: 'row', gap: 8 },
  accountPicker: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
  accountPickerLabel: { fontSize: 11, fontWeight: '700', color: b.colors.muted },
  accountPickerValue: { fontSize: 14, color: b.colors.text, marginTop: 4 },
  filterActions: { flexDirection: 'row', gap: 8 },
  applyBtn: {
    flex: 1,
    backgroundColor: b.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: { color: '#FFFFFF', fontWeight: '700' },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  resetBtnText: { color: b.colors.text, fontWeight: '700' },
  accountNote: {
    fontSize: 12,
    color: b.colors.muted,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  error: { color: b.colors.danger, paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  empty: { textAlign: 'center', color: b.colors.muted, padding: 24 },
  cappedNote: {
    textAlign: 'center',
    color: b.colors.muted,
    padding: 16,
    fontSize: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardDate: { fontSize: 12, color: b.colors.muted, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardType: { fontSize: 14, fontWeight: '800', color: b.colors.text },
  cardParty: { fontSize: 13, color: b.colors.text, marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: b.colors.primary, marginTop: 4 },
  cardDesc: { fontSize: 12, color: b.colors.muted, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: b.colors.text },
  accountRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  accountRowCode: { fontSize: 13, fontWeight: '700', color: b.colors.text },
  accountRowName: { fontSize: 12, color: b.colors.muted, marginTop: 2 },
  detailLine: { fontSize: 14, color: b.colors.text, marginBottom: 8, lineHeight: 20 },
  detailLabel: { fontWeight: '700' },
  })
}
