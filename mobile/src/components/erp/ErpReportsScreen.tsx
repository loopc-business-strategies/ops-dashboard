import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTenantBranding } from '@/src/context/TenantContext'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import { useAuth } from '@/src/context/AuthContext'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import {
  fetchAccountsForLedger,
  getAccountEnquiry,
  getBalanceSheetReport,
  getCustomerOutstandingReport,
  getDayBookReport,
  getForexGainLossReport,
  getLedgerReport,
  getProfitLossReport,
  getTrialBalanceReport,
  getVendorOutstandingReport,
  type AccountListItem,
  type AccountEnquiryPayload,
} from '@/src/api/erpReports'
import { LiveMetalPricesBar } from '@/src/components/dashboard/LiveMetalPricesBar'
import { AccountEnquirySummaryCard } from '@/src/components/erp/AccountEnquirySummaryCard'
import { fmtSigned } from '@/src/utils/format'
import { buildReportDateRange, type ReportPeriod } from '@/src/utils/reportDateRange'
import { trialBalanceRowsForView, type TrialBalanceRow } from '@/src/utils/trialBalanceReportRows'
import { canAccessErpReports } from '@/src/utils/erpSubTabPermissions'

export type ErpReportViewId =
  | 'summary'
  | 'trial'
  | 'pnl'
  | 'balanceSheet'
  | 'dayBook'
  | 'outstanding'
  | 'forex'
  | 'ledger'

const REPORT_VIEWS: { id: ErpReportViewId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'trial', label: 'Trial Balance' },
  { id: 'pnl', label: 'P&L' },
  { id: 'balanceSheet', label: 'Balance Sheet' },
  { id: 'dayBook', label: 'Day Book' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'forex', label: 'Forex' },
  { id: 'ledger', label: 'Ledger drilldown' },
]

const TRIAL_UI_CAP = 250
const REPORT_REFRESH_DEBOUNCE_MS = 250
const REPORT_RATE_LIMIT_COOLDOWN_MS = 60_000

function num(v: unknown) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function fmt(v: unknown) {
  return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /too many report requests|request failed \(429\)/i.test(message)
}

export default function ErpReportsScreen({
  initialAccountCode = '',
  initialView = '',
}: {
  initialAccountCode?: string
  initialView?: string
} = {}) {
  const { token, user } = useAuth()
  const { branding } = useTenantBranding()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()
  const allowed = canAccessErpReports(user)
  const styles = useMemo(() => createErpStyles(branding), [branding])

  const [reportView, setReportView] = useState<ErpReportViewId>('summary')
  const [period, setPeriod] = useState<ReportPeriod>('ytd')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [includeZeroTrial, setIncludeZeroTrial] = useState(false)

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [trialBalance, setTrialBalance] = useState<unknown>(null)
  const [profitLoss, setProfitLoss] = useState<unknown>(null)
  const [balanceSheet, setBalanceSheet] = useState<unknown>(null)
  const [dayBook, setDayBook] = useState<unknown>(null)
  const [customerOutstanding, setCustomerOutstanding] = useState<unknown>(null)
  const [vendorOutstanding, setVendorOutstanding] = useState<unknown>(null)
  const [forex, setForex] = useState<unknown>(null)

  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [accountQuery, setAccountQuery] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [ledgerRows, setLedgerRows] = useState<unknown[]>([])
  const [enquiryData, setEnquiryData] = useState<AccountEnquiryPayload | null>(null)
  const [enquiryLoading, setEnquiryLoading] = useState(false)
  const refreshRef = useRef<{ key: string; promise: Promise<void> | null }>({ key: '', promise: null })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshSeqRef = useRef(0)
  const rateLimitCooldownUntilRef = useRef(0)

  const dateCtx = useMemo(
    () => buildReportDateRange(period, customStart.trim(), customEnd.trim()),
    [period, customStart, customEnd],
  )

  const refresh = useCallback(async () => {
    if (!token || !allowed || !sessionReady) {
      setLoading(false)
      return
    }
    if (Date.now() < rateLimitCooldownUntilRef.current) {
      setError('Too many report requests. Please wait and try again.')
      setLoading(false)
      return
    }
    const requestKey = JSON.stringify({
      reportView,
      range: dateCtx.commonRange,
      endDate: dateCtx.endDate,
      includeZeroTrial,
      selectedAccountId,
    })
    if (refreshRef.current.key === requestKey && refreshRef.current.promise) {
      return refreshRef.current.promise
    }

    setLoading(true)
    setError('')
    const { commonRange, endDate } = dateCtx
    const seq = refreshSeqRef.current + 1
    refreshSeqRef.current = seq
    const promise = (async () => {
      try {
        if (reportView === 'summary' || reportView === 'trial') {
          const includeZero = reportView === 'summary' ? false : includeZeroTrial
          const data = await getTrialBalanceReport(token, {
            ...commonRange,
            includeZero,
            sortBy: 'accountCode',
            sortDir: 'asc',
          })
          if (seq === refreshSeqRef.current) setTrialBalance(data)
        }
        if (reportView === 'pnl') {
          const data = await getProfitLossReport(token, {
            ...commonRange,
            includeZero: false,
            comparePrevious: true,
          })
          if (seq === refreshSeqRef.current) setProfitLoss(data)
        }
        if (reportView === 'balanceSheet') {
          const data = await getBalanceSheetReport(token, {
            ...(endDate ? { endDate } : {}),
          })
          if (seq === refreshSeqRef.current) setBalanceSheet(data)
        }
        if (reportView === 'dayBook') {
          const data = await getDayBookReport(token, { ...commonRange })
          if (seq === refreshSeqRef.current) setDayBook(data)
        }
        if (reportView === 'outstanding') {
          const [cust, ven] = await Promise.all([
            getCustomerOutstandingReport(token),
            getVendorOutstandingReport(token),
          ])
          if (seq === refreshSeqRef.current) {
            setCustomerOutstanding(cust)
            setVendorOutstanding(ven)
          }
        }
        if (reportView === 'forex') {
          const data = await getForexGainLossReport(token, { ...commonRange })
          if (seq === refreshSeqRef.current) setForex(data)
        }
        if (reportView === 'ledger') {
          const accRes = await fetchAccountsForLedger(token)
          if (seq === refreshSeqRef.current) setAccounts(accRes.accounts || [])
          if (selectedAccountId) {
            const led = await getLedgerReport(token, {
              accountId: selectedAccountId,
              ...commonRange,
            })
            if (seq === refreshSeqRef.current) setLedgerRows((led as { report?: unknown[] })?.report || [])
          } else if (seq === refreshSeqRef.current) {
            setLedgerRows([])
          }
        }
        if (seq === refreshSeqRef.current) setError('')
      } catch (e) {
        if (isRateLimitError(e)) {
          rateLimitCooldownUntilRef.current = Date.now() + REPORT_RATE_LIMIT_COOLDOWN_MS
        }
        if (seq === refreshSeqRef.current) setError(e instanceof Error ? e.message : 'Failed to load report')
      } finally {
        if (refreshRef.current.key === requestKey) {
          refreshRef.current = { key: '', promise: null }
        }
        if (seq === refreshSeqRef.current) {
          setLoading(false)
        }
      }
    })()
    refreshRef.current = { key: requestKey, promise }
    return promise
  }, [token, allowed, sessionReady, dateCtx, includeZeroTrial, selectedAccountId, reportView])

  useEffect(() => {
    setTrialBalance(null)
    setProfitLoss(null)
    setBalanceSheet(null)
    setDayBook(null)
    setCustomerOutstanding(null)
    setVendorOutstanding(null)
    setForex(null)
    setAccounts([])
    setLedgerRows([])
    setEnquiryData(null)
    setError('')
    setLoading(false)
  }, [tenantSessionKey])

  useEffect(() => {
    if (!token || !allowed || !sessionReady) {
      setLoading(false)
      return undefined
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      void refresh()
    }, REPORT_REFRESH_DEBOUNCE_MS)
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [token, allowed, sessionReady, tenantSessionKey, refresh])

  const onRefresh = useCallback(async () => {
    if (!token || !allowed) return
    setRefreshing(true)
    setError('')
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [token, allowed, refresh])

  const reloadLedgerForAccount = useCallback(async () => {
    if (!token || !allowed || reportView !== 'ledger' || !selectedAccountId) {
      setLedgerRows([])
      return
    }
    try {
      const led = await getLedgerReport(token, {
        accountId: selectedAccountId,
        ...dateCtx.commonRange,
      })
      setLedgerRows((led as { report?: unknown[] })?.report || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ledger')
    }
  }, [token, allowed, reportView, selectedAccountId, dateCtx.commonRange])

  useEffect(() => {
    const code = String(initialAccountCode || '').trim()
    if (!code || !token || !allowed) return undefined
    setEnquiryLoading(true)
    setAccountQuery(code)
    if (initialView === 'statement') setReportView('ledger')
    let cancelled = false
    void getAccountEnquiry(token, code)
      .then((res) => {
        if (cancelled) return
        setEnquiryData(res || null)
      })
      .catch(() => {
        if (!cancelled) setEnquiryData(null)
      })
      .finally(() => {
        if (!cancelled) setEnquiryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialAccountCode, initialView, token, allowed])

  useEffect(() => {
    const code = String(initialAccountCode || '').trim()
    if (!code || !accounts.length || !token) return undefined
    const match = accounts.find((a) => String(a.accountCode || '').trim() === code)
    if (!match) return undefined
    setSelectedAccountId(match._id)
    return undefined
  }, [initialAccountCode, accounts])

  const trialRowsRaw = (trialBalance as { trialBalance?: TrialBalanceRow[] } | null)?.trialBalance || []
  const trialRows = trialBalanceRowsForView(reportView, trialRowsRaw)
  const trialShown = trialRows.slice(0, TRIAL_UI_CAP)

  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        String(a.accountCode || '').toLowerCase().includes(q) ||
        String(a.accountName || '').toLowerCase().includes(q),
    )
  }, [accounts, accountQuery])

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Sign in to view ERP reports.</Text>
      </View>
    )
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>You do not have access to ERP Reports.</Text>
      </View>
    )
  }

  if (!sessionReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Preparing your company session…</Text>
      </View>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>ERP Reports</Text>
      <Text style={styles.lead}>Same report types as the web dashboard. Pull down to refresh.</Text>

      <LiveMetalPricesBar />

      {initialAccountCode ? (
        <AccountEnquirySummaryCard
          accountCode={initialAccountCode}
          enquiry={enquiryData}
          loading={enquiryLoading}
          branding={branding}
        />
      ) : null}

      <Text style={styles.section}>Period</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {(['today', 'month', 'ytd', 'custom'] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.chip, period === p && styles.chipOn]}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextOn]}>
              {p === 'custom' ? 'Custom' : p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {period === 'custom' ? (
        <View style={styles.customDates}>
          <TextInput
            placeholder="Start YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            value={customStart}
            onChangeText={setCustomStart}
            style={styles.input}
          />
          <TextInput
            placeholder="End YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            value={customEnd}
            onChangeText={setCustomEnd}
            style={styles.input}
          />
        </View>
      ) : null}

      <Text style={styles.section}>Report</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {REPORT_VIEWS.map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setReportView(id)}
            style={[styles.chip, reportView === id && styles.chipOn]}
          >
            <Text style={[styles.chipText, reportView === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {reportView === 'trial' ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Include zero-balance accounts</Text>
          <Switch value={includeZeroTrial} onValueChange={setIncludeZeroTrial} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator color={branding.colors.primary} />
        </View>
      ) : null}

      <Text style={styles.periodNote}>
        {dateCtx.startDate && dateCtx.endDate
          ? `${dateCtx.startDate} → ${dateCtx.endDate}`
          : 'Select a custom date range'}
      </Text>

      {(reportView === 'summary' || reportView === 'trial') && trialBalance ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{reportView === 'summary' ? 'Summary' : 'Trial Balance'}</Text>
          <Text style={styles.meta}>
            Debit {fmt((trialBalance as { totalDebit?: number }).totalDebit)} · Credit{' '}
            {fmt((trialBalance as { totalCredit?: number }).totalCredit)}
          </Text>
          <Text
            style={[
              styles.meta,
              (trialBalance as { balanced?: boolean }).balanced ? styles.trialOk : styles.trialWarn,
            ]}
          >
            {(trialBalance as { balanced?: boolean }).balanced ? 'Balanced' : 'Difference Found'}
          </Text>
          {!(trialBalance as { balanced?: boolean }).balanced &&
          (trialBalance as { difference?: number }).difference != null ? (
            <Text style={styles.metaSmall}>
              Difference {fmt((trialBalance as { difference?: number }).difference)}
            </Text>
          ) : null}
          {trialRows.length > TRIAL_UI_CAP ? (
            <Text style={styles.meta}>Showing first {TRIAL_UI_CAP} of {trialRows.length} rows.</Text>
          ) : null}
          {trialShown.map((row, i) => (
            <View key={`${row.accountCode}-${i}`} style={[styles.row, styles.rowTrial]}>
              <Text style={styles.rowCode}>{row.accountCode}</Text>
              <View style={styles.rowMain}>
                <Text style={styles.rowNameBlock} numberOfLines={2}>
                  {row.accountName}
                </Text>
                <Text style={styles.rowSub}>
                  Dr {fmt(row.debit)} · Cr {fmt(row.credit)} · Net {fmtSigned(row.net)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {reportView === 'pnl' && profitLoss ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profit & Loss</Text>
          <Text style={styles.meta}>
            Net {(profitLoss as { netProfit?: number }).netProfit ?? 0} · Income{' '}
            {(profitLoss as { totalIncome?: number }).totalIncome ?? 0} · Expense{' '}
            {(profitLoss as { totalExpense?: number }).totalExpense ?? 0}
          </Text>
          <Text style={styles.subhead}>Income</Text>
          {((profitLoss as { incomeBreakdown?: { accountCode?: string; accountName?: string; amount?: number }[] })
            .incomeBreakdown || []
          ).slice(0, 80)
            .map((row, i) => (
              <View key={`i-${i}`} style={styles.row}>
                <Text style={styles.rowCode}>{row.accountCode}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {row.accountName}
                </Text>
                <Text style={styles.rowRight}>{fmt(row.amount)}</Text>
              </View>
            ))}
          <Text style={styles.subhead}>Expense</Text>
          {((profitLoss as { expenseBreakdown?: { accountCode?: string; accountName?: string; amount?: number }[] })
            .expenseBreakdown || []
          ).slice(0, 80)
            .map((row, i) => (
              <View key={`e-${i}`} style={styles.row}>
                <Text style={styles.rowCode}>{row.accountCode}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {row.accountName}
                </Text>
                <Text style={styles.rowRight}>{fmt(row.amount)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {reportView === 'balanceSheet' && balanceSheet ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Balance Sheet</Text>
          {(['assets', 'liabilities', 'equity'] as const).map((section) => (
            <View key={section}>
              <Text style={styles.subhead}>{section.charAt(0).toUpperCase() + section.slice(1)}</Text>
              {(
                (balanceSheet as Record<string, { accountCode?: string; accountName?: string; balance?: number }[]>)[
                  section
                ] || []
              )
                .slice(0, 100)
                .map((row, i) => (
                  <View key={`${section}-${i}`} style={styles.row}>
                    <Text style={styles.rowCode}>{row.accountCode}</Text>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {row.accountName}
                    </Text>
                    <Text style={styles.rowRight}>{fmtSigned(row.balance)}</Text>
                  </View>
                ))}
            </View>
          ))}
        </View>
      ) : null}

      {reportView === 'dayBook' && dayBook ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Day Book</Text>
          <Text style={styles.meta}>
            Entries {(dayBook as { totals?: { count?: number } }).totals?.count ?? 0}
          </Text>
          {((dayBook as { entries?: { _id?: string; date?: string; description?: string; amount?: number }[] }).entries || [])
            .slice(0, 150)
            .map((e) => (
              <View key={String(e._id)} style={styles.row}>
                <Text style={styles.rowCode}>{e.date ? String(e.date).slice(0, 10) : ''}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {e.description || '—'}
                </Text>
                <Text style={styles.rowRight}>{fmt(e.amount)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {reportView === 'outstanding' && customerOutstanding && vendorOutstanding ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer outstanding</Text>
          {(
            (customerOutstanding as { rows?: { customerName?: string; outstanding?: number }[] }).rows || []
          ).map((r, i) => (
            <View key={`c-${i}`} style={styles.row}>
              <Text style={styles.rowName}>{r.customerName}</Text>
              <Text style={styles.rowRight}>{fmt(r.outstanding)}</Text>
            </View>
          ))}
          <Text style={styles.subhead}>Vendor outstanding</Text>
          {((vendorOutstanding as { rows?: { vendorName?: string; outstanding?: number }[] }).rows || []).map(
            (r, i) => (
              <View key={`v-${i}`} style={styles.row}>
                <Text style={styles.rowName}>{r.vendorName}</Text>
                <Text style={styles.rowRight}>{fmt(r.outstanding)}</Text>
              </View>
            ),
          )}
        </View>
      ) : null}

      {reportView === 'forex' && forex ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Forex</Text>
          <Text style={styles.meta}>
            Impact {fmt((forex as { forexImpact?: number }).forexImpact)} · Entries{' '}
            {(forex as { entriesCount?: number }).entriesCount ?? 0}
          </Text>
          {Object.entries((forex as { byCurrency?: Record<string, { count?: number; impact?: number }> }).byCurrency || {}).map(
            ([cur, row]) => (
              <View key={cur} style={styles.row}>
                <Text style={styles.rowName}>{cur}</Text>
                <Text style={styles.rowRight}>
                  {row.count ?? 0} / {fmt(row.impact)}
                </Text>
              </View>
            ),
          )}
        </View>
      ) : null}

      {reportView === 'ledger' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ledger drilldown</Text>
          <TextInput
            placeholder="Search account code or name"
            placeholderTextColor="#9CA3AF"
            value={accountQuery}
            onChangeText={setAccountQuery}
            style={styles.input}
          />
          <ScrollView style={styles.accountPick} nestedScrollEnabled>
            {filteredAccounts.slice(0, 80).map((a) => (
              <Pressable
                key={a._id}
                onPress={() => {
                  if (!token) return
                  setSelectedAccountId(a._id)
                  getLedgerReport(token, { accountId: a._id, ...dateCtx.commonRange })
                    .then((led) => setLedgerRows((led as { report?: unknown[] })?.report || []))
                    .catch((e) => setError(e instanceof Error ? e.message : 'Ledger failed'))
                }}
                style={[styles.accRow, selectedAccountId === a._id && styles.accRowOn]}
              >
                <Text style={styles.rowCode}>{a.accountCode}</Text>
                <Text style={styles.rowName} numberOfLines={1}>
                  {a.accountName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.btn} onPress={reloadLedgerForAccount}>
            <Text style={styles.btnText}>Reload ledger lines</Text>
          </Pressable>
          {ledgerRows.slice(0, 200).map((row, i) => {
            const r = row as {
              date?: string
              description?: string
              amount?: number
              runningBalance?: number
            }
            return (
              <View key={i} style={styles.row}>
                <Text style={styles.rowCode}>{r.date ? String(r.date).slice(0, 10) : ''}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {r.description || '—'}
                </Text>
                <Text style={styles.rowRight}>{fmt(r.runningBalance)}</Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </ScrollView>
  )
}

function createErpStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: b.colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: b.colors.text },
  lead: { marginTop: 6, fontSize: 14, color: b.colors.muted, lineHeight: 20 },
  section: { marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '700', color: b.colors.text },
  chipRow: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: b.colors.primary, borderColor: b.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: b.colors.text },
  chipTextOn: { color: '#fff' },
  customDates: { gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    color: b.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, color: b.colors.text, flex: 1 },
  error: { color: '#B91C1C', marginTop: 12, fontWeight: '600' },
  loader: { marginVertical: 16 },
  muted: { color: b.colors.muted, fontSize: 15 },
  periodNote: { marginTop: 8, fontSize: 12, color: b.colors.muted },
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: b.colors.text },
  meta: { fontSize: 12, color: b.colors.muted, marginBottom: 8 },
  metaSmall: { fontSize: 11, color: '#B91C1C', marginBottom: 6, fontWeight: '600' },
  trialOk: { fontSize: 13, color: '#0284C7', fontWeight: '700', marginBottom: 8 },
  trialWarn: { fontSize: 13, color: '#B91C1C', fontWeight: '700', marginBottom: 8 },
  subhead: { marginTop: 12, marginBottom: 6, fontSize: 14, fontWeight: '700', color: b.colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  rowTrial: { alignItems: 'flex-start' },
  rowCode: { width: 56, fontSize: 11, fontWeight: '700', color: b.colors.text },
  rowMain: { flex: 1, minWidth: 0 },
  rowNameBlock: { fontSize: 13, color: b.colors.text },
  rowName: { flex: 1, fontSize: 13, color: b.colors.text },
  rowSub: { marginTop: 4, fontSize: 11, color: b.colors.muted, fontWeight: '600' },
  rowRight: { fontSize: 12, fontWeight: '600', color: b.colors.text },
  accountPick: { maxHeight: 220, marginBottom: 8 },
  accRow: { flexDirection: 'row', paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  accRowOn: { backgroundColor: '#ECFDF5' },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: b.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  })
}
