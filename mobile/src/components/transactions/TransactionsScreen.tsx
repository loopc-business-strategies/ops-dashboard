import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
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
import { operationKeyToApiType } from '@/src/constants/transactionTypes'
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

type ApiFilterState = Pick<
  OperationsFilterState,
  'startDate' | 'endDate' | 'status' | 'operationKey'
>

const DEFAULT_MONTH = currentMonthDateRange()

const DEFAULT_FILTERS: OperationsFilterState = {
  search: '',
  status: '',
  operationKey: '',
  startDate: DEFAULT_MONTH.startDate,
  endDate: DEFAULT_MONTH.endDate,
  accountCode: '',
}

function buildTxnApiParams(filters: ApiFilterState) {
  return {
    status: filters.status || undefined,
    type: operationKeyToApiType(filters.operationKey),
    startDate: normalizeDateInput(filters.startDate) || undefined,
    endDate: normalizeDateInput(filters.endDate) || undefined,
  }
}

function apiFilterKeyFrom(filters: ApiFilterState): string {
  return JSON.stringify({
    startDate: filters.startDate,
    endDate: filters.endDate,
    status: filters.status,
    operationKey: filters.operationKey,
  })
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
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataRefreshing, setDataRefreshing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('outcome')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<OperationEntry | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const isFirstLoadRef = useRef(true)
  const baseCurrencyRef = useRef(baseCurrency)
  baseCurrencyRef.current = baseCurrency

  const apiFilters = useMemo<ApiFilterState>(
    () => ({
      startDate: appliedFilters.startDate,
      endDate: appliedFilters.endDate,
      status: appliedFilters.status,
      operationKey: appliedFilters.operationKey,
    }),
    [
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.status,
      appliedFilters.operationKey,
    ],
  )

  const apiFilterKey = useMemo(() => apiFilterKeyFrom(apiFilters), [apiFilters])

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'filter' = 'initial') => {
      if (!token || !allowed || !sessionReady) {
        setInitialLoading(false)
        setDataRefreshing(false)
        setRefreshing(false)
        return
      }
      if (mode === 'refresh') setRefreshing(true)
      else if (mode === 'initial') setInitialLoading(true)
      else setDataRefreshing(true)
      setError('')

      const rangeCheck = validateDateRange(apiFilters.startDate, apiFilters.endDate)
      if (!rangeCheck.ok) {
        setError(rangeCheck.message)
        setInitialLoading(false)
        setDataRefreshing(false)
        setRefreshing(false)
        return
      }

      const dateParams = {
        startDate: normalizeDateInput(apiFilters.startDate) || undefined,
        endDate: normalizeDateInput(apiFilters.endDate) || undefined,
      }

      try {
        const [txnRes, jvRes] = await Promise.all([
          canTransactions
            ? fetchAllTransactions(token, buildTxnApiParams(apiFilters))
            : Promise.resolve({ transactions: [], capped: false }),
          canLedger
            ? fetchAllJvLedgerEntries(token, dateParams)
            : Promise.resolve({ entries: [], capped: false }),
        ])

        setTransactions(txnRes.transactions || [])
        setTxnCapped(Boolean(txnRes.capped))
        setJvRawCount((jvRes.entries || []).length)
        setGroupedJvs(
          groupJvLedgerEntries(jvRes.entries || [], { baseCurrencyCode: baseCurrencyRef.current }),
        )
        setJvCapped(Boolean(jvRes.capped))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load operations')
        setTransactions([])
        setGroupedJvs([])
      } finally {
        setInitialLoading(false)
        setDataRefreshing(false)
        setRefreshing(false)
      }
    },
    [token, allowed, sessionReady, apiFilters, canTransactions, canLedger],
  )

  useEffect(() => {
    setTransactions([])
    setGroupedJvs([])
    setError('')
    setViewMode('list')
    setInitialLoading(true)
    isFirstLoadRef.current = true
  }, [tenantSessionKey])

  useEffect(() => {
    if (!token || !sessionReady) return
    void fetchCurrencies(token)
      .then((res) => setBaseCurrency(resolveBaseCurrencyCode(res.currencies, 'USD')))
      .catch(() => setBaseCurrency('USD'))
  }, [token, sessionReady, tenantSessionKey])

  useEffect(() => {
    if (!token || !allowed || !sessionReady) {
      setInitialLoading(false)
      return
    }
    const mode = isFirstLoadRef.current ? 'initial' : 'filter'
    void load(mode).finally(() => {
      isFirstLoadRef.current = false
    })
  }, [token, allowed, sessionReady, tenantSessionKey, apiFilterKey, load])

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
  const loadingAllDates =
    dataRefreshing && !appliedFilters.startDate && !appliedFilters.endDate

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

  const handleSelectEntry = useCallback((item: OperationEntry) => {
    setSelectedEntry(item)
  }, [])

  const renderListItem = useCallback(
    ({ item }: { item: OperationEntry }) => (
      <OperationListItem
        entry={item}
        styles={styles}
        branding={branding}
        onPress={() => handleSelectEntry(item)}
      />
    ),
    [styles, branding, handleSelectEntry],
  )

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

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  const analysisTotal = analysisMode === 'outcome' ? totals.outcome : totals.income

  return (
    <View style={styles.root}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>Transactions</Text>
        <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8}>
          <Text style={{ fontSize: 18, color: branding.colors.primary }}>{showSearch ? '✕' : '⌕'}</Text>
        </Pressable>
      </View>

      {viewMode === 'list' && !canLedger && canTransactions ? (
        <Text style={styles.note}>Journal vouchers require ledger access.</Text>
      ) : null}
      {viewMode === 'list' && !canTransactions && canLedger ? (
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

      {dataRefreshing ? (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color={branding.colors.primary} />
          <Text style={styles.refreshBannerText}>
            {loadingAllDates ? 'Loading all 2026 transactions…' : 'Updating…'}
          </Text>
        </View>
      ) : null}

      {viewMode === 'list' ? (
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
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {viewMode === 'analysis' ? (
        <View style={{ flex: 1 }}>
          <FinancialAnalysisView
            mode={analysisMode}
            total={analysisTotal}
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
        </View>
      ) : null}

      {viewMode === 'category' ? (
        <View style={{ flex: 1 }}>
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
        </View>
      ) : null}

      {viewMode === 'list' ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
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
          renderItem={renderListItem}
        />
      ) : null}

      <OperationDetailModal entry={selectedEntry} styles={styles} onClose={() => setSelectedEntry(null)} />
    </View>
  )
}
