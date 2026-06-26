import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native'
import { fetchCurrencies, resolveBaseCurrencyCode } from '@/src/api/currencies'
import { fetchAllJvLedgerEntries } from '@/src/api/ledger'
import { fetchAccountsForLedger, type AccountListItem } from '@/src/api/erpReports'
import { fetchAllTransactions, type TransactionRow } from '@/src/api/transactions'
import CategoryDetailView from '@/src/components/transactions/CategoryDetailView'
import FinancialAnalysisView from '@/src/components/transactions/FinancialAnalysisView'
import OperationDetailModal from '@/src/components/transactions/OperationDetailModal'
import OperationListItem from '@/src/components/transactions/OperationListItem'
import OperationsFilterBar from '@/src/components/transactions/OperationsFilterBar'
import OutcomeIncomeCards from '@/src/components/transactions/OutcomeIncomeCards'
import { createOperationsStyles } from '@/src/components/transactions/operationsStyles'
import { chipToApiType } from '@/src/constants/transactionTypes'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantBranding } from '@/src/context/TenantContext'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import {
  canAccessLedger,
  canAccessOperations,
  canAccessTransactions,
} from '@/src/utils/erpSubTabPermissions'
import { groupJvLedgerEntries } from '@/src/utils/jvLedgerGrouping'
import { normalizeDateInput, validateDateRange } from '@/src/utils/dateInput'
import {
  buildOperationEntries,
  computeCategorySummaries,
  computeOutcomeIncome,
  currentMonthDateRange,
  filterOperationEntries,
  formatPeriodLabel,
  groupEntriesByDate,
  type OperationEntry,
  type OperationsFilterState,
} from '@/src/utils/operationsFeed'

type ViewMode = 'list' | 'analysis' | 'category'
type AnalysisMode = 'outcome' | 'income'

const DEFAULT_MONTH = currentMonthDateRange()

const DEFAULT_FILTERS: OperationsFilterState = {
  search: '',
  status: '',
  operationKey: '',
  startDate: DEFAULT_MONTH.startDate,
  endDate: DEFAULT_MONTH.endDate,
  accountCode: '',
}

function buildTxnApiParams(filters: OperationsFilterState) {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    type: chipToApiType(
      filters.operationKey.startsWith('txn_') ? filters.operationKey.replace(/^txn_/, '') : '',
    ),
    startDate: normalizeDateInput(filters.startDate) || undefined,
    endDate: normalizeDateInput(filters.endDate) || undefined,
  }
}

export default function TransactionsScreen() {
  const { token, user } = useAuth()
  const { branding } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const styles = useMemo(() => createOperationsStyles(branding), [branding])

  const canTransactions = canAccessTransactions(user)
  const canLedger = canAccessLedger(user)
  const allowed = canAccessOperations(user)

  const [draftFilters, setDraftFilters] = useState<OperationsFilterState>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<OperationsFilterState>(DEFAULT_FILTERS)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [jvRawCount, setJvRawCount] = useState(0)
  const [groupedJvs, setGroupedJvs] = useState<ReturnType<typeof groupJvLedgerEntries>>([])
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [txnCapped, setTxnCapped] = useState(false)
  const [jvCapped, setJvCapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('outcome')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<OperationEntry | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token || !allowed || !sessionReady) {
        setLoading(false)
        setRefreshing(false)
        return
      }
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

      const dateParams = {
        startDate: normalizeDateInput(appliedFilters.startDate) || undefined,
        endDate: normalizeDateInput(appliedFilters.endDate) || undefined,
      }

      try {
        const [currencyRes, txnRes, jvRes] = await Promise.all([
          fetchCurrencies(token).catch(() => ({ currencies: [] })),
          canTransactions
            ? fetchAllTransactions(token, buildTxnApiParams(appliedFilters))
            : Promise.resolve({ transactions: [], capped: false }),
          canLedger
            ? fetchAllJvLedgerEntries(token, dateParams)
            : Promise.resolve({ entries: [], capped: false }),
        ])

        const base = resolveBaseCurrencyCode(currencyRes.currencies, 'USD')
        setBaseCurrency(base)
        setTransactions(txnRes.transactions || [])
        setTxnCapped(Boolean(txnRes.capped))
        setJvRawCount((jvRes.entries || []).length)
        setGroupedJvs(groupJvLedgerEntries(jvRes.entries || [], { baseCurrencyCode: base }))
        setJvCapped(Boolean(jvRes.capped))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load operations')
        setTransactions([])
        setGroupedJvs([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [token, allowed, sessionReady, appliedFilters, canTransactions, canLedger],
  )

  useEffect(() => {
    if (!token || !allowed || !sessionReady) {
      setLoading(false)
      return
    }
    void load('initial')
  }, [token, allowed, sessionReady, tenantSessionKey, appliedFilters, load])

  useEffect(() => {
    setTransactions([])
    setGroupedJvs([])
    setError('')
    setViewMode('list')
    setLoading(true)
  }, [tenantSessionKey])

  useEffect(() => {
    if (!token || !allowed || !sessionReady) return
    void fetchAccountsForLedger(token)
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
  }, [token, allowed, sessionReady, tenantSessionKey])

  const allEntries = useMemo(
    () => buildOperationEntries(transactions, groupedJvs, baseCurrency),
    [transactions, groupedJvs, baseCurrency],
  )

  const displayEntries = useMemo(
    () => filterOperationEntries(allEntries, appliedFilters),
    [allEntries, appliedFilters],
  )

  const totals = useMemo(() => computeOutcomeIncome(displayEntries), [displayEntries])
  const categories = useMemo(() => computeCategorySummaries(displayEntries), [displayEntries])
  const sections = useMemo(() => groupEntriesByDate(displayEntries), [displayEntries])
  const periodLabel = formatPeriodLabel(appliedFilters.startDate, appliedFilters.endDate)

  const categoryEntries = useMemo(
    () => displayEntries.filter((e) => e.categoryKey === selectedCategory),
    [displayEntries, selectedCategory],
  )

  const categoryTotal = useMemo(
    () => categoryEntries.reduce((s, e) => s + Math.abs(Number(e.amount || 0)), 0),
    [categoryEntries],
  )

  const applyFilters = (override?: OperationsFilterState) => {
    const next = override ?? draftFilters
    const rangeCheck = validateDateRange(next.startDate, next.endDate)
    if (!rangeCheck.ok) {
      setError(rangeCheck.message)
      return
    }
    setError('')
    const normalized = {
      ...next,
      startDate: normalizeDateInput(next.startDate),
      endDate: normalizeDateInput(next.endDate),
    }
    setDraftFilters(normalized)
    setAppliedFilters(normalized)
  }

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setError('')
    setViewMode('list')
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Transactions unavailable</Text>
        <Text style={styles.deniedText}>
          Your role does not include access to ERP transactions or ledger.
        </Text>
      </View>
    )
  }

  if (!sessionReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedText}>Preparing your company session…</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  if (viewMode === 'analysis') {
    const total = analysisMode === 'outcome' ? totals.outcome : totals.income
    return (
      <View style={styles.root}>
        <FinancialAnalysisView
          mode={analysisMode}
          total={total}
          currency={baseCurrency}
          periodLabel={periodLabel}
          categories={categories}
          branding={branding}
          styles={styles}
          onBack={() => setViewMode('list')}
          onSelectCategory={(key) => {
            setSelectedCategory(key)
            setViewMode('category')
          }}
        />
        <OperationDetailModal entry={selectedEntry} styles={styles} onClose={() => setSelectedEntry(null)} />
      </View>
    )
  }

  if (viewMode === 'category') {
    return (
      <View style={styles.root}>
        <CategoryDetailView
          categoryKey={selectedCategory}
          entries={categoryEntries}
          total={categoryTotal}
          currency={baseCurrency}
          periodLabel={periodLabel}
          branding={branding}
          styles={styles}
          onBack={() => setViewMode('analysis')}
          onSelectEntry={setSelectedEntry}
        />
        <OperationDetailModal entry={selectedEntry} styles={styles} onClose={() => setSelectedEntry(null)} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>Transactions</Text>
        <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8}>
          <Text style={{ fontSize: 18, color: branding.colors.primary }}>{showSearch ? '✕' : '⌕'}</Text>
        </Pressable>
      </View>

      {!canLedger && canTransactions ? (
        <Text style={styles.note}>Journal vouchers require ledger access.</Text>
      ) : null}
      {!canTransactions && canLedger ? (
        <Text style={styles.note}>Showing ledger journal vouchers only.</Text>
      ) : null}

      <OperationsFilterBar
        filters={appliedFilters}
        draftFilters={draftFilters}
        onChangeDraft={setDraftFilters}
        onApply={applyFilters}
        accounts={accounts}
        canTransactions={canTransactions}
        canLedger={canLedger}
        branding={branding}
        styles={styles}
      />

      {showSearch ? (
        <TextInput
          style={[styles.input, { marginHorizontal: 12 }]}
          placeholder="Search narration, party, voucher…"
          placeholderTextColor={branding.colors.muted}
          value={draftFilters.search}
          onChangeText={(search) => {
            setDraftFilters((p) => ({ ...p, search }))
            setAppliedFilters((p) => ({ ...p, search }))
          }}
        />
      ) : null}

      <OutcomeIncomeCards
        outcome={totals.outcome}
        income={totals.income}
        currency={baseCurrency}
        branding={branding}
        onPressOutcome={() => {
          setAnalysisMode('outcome')
          setViewMode('analysis')
        }}
        onPressIncome={() => {
          setAnalysisMode('income')
          setViewMode('analysis')
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No operations match your filters.</Text>}
        ListFooterComponent={
          txnCapped || jvCapped ? (
            <Text style={styles.cappedNote}>
              Showing up to 500 transactions
              {canLedger ? ` and ${jvRawCount} ledger lines` : ''}. Narrow the date range to see more.
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <OperationListItem
            entry={item}
            styles={styles}
            branding={branding}
            onPress={() => setSelectedEntry(item)}
          />
        )}
      />

      <OperationDetailModal entry={selectedEntry} styles={styles} onClose={() => setSelectedEntry(null)} />
    </View>
  )
}
