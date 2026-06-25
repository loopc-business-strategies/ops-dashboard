import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import type { AccountEnquiryPayload } from '@/src/api/erpReports'
import { useErpLiveMetalSpotPrices } from '@/src/hooks/useErpLiveMetalSpotPrices'
import { fmtPosition, fmtSigned } from '@/src/utils/format'
import {
  buildAccountEnquiryLiveMetrics,
  calculateAccountSummaryMetrics,
  deriveEnquiryMetalBalances,
  hasAccountEnquiryMetalExposure,
  resolveAccountEnquiryBookedRevaluation,
} from '@/src/utils/buildAccountEnquiryLiveMetrics'
import { shouldSuppressSpotMetalMtmForAccountEnquiry } from '@/src/utils/metalMarginPolicy'

function fmt(n: unknown, digits = 2) {
  const v = Number(n ?? 0)
  return Number.isFinite(v)
    ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '0.00'
}

type Props = {
  accountCode: string
  enquiry: AccountEnquiryPayload | null
  loading: boolean
  branding: MobileTenantBranding
}

export function AccountEnquirySummaryCard({ accountCode, enquiry, loading, branding }: Props) {
  const { goldPriceUSD, silverPriceUSD, liveRecalcEnabled } = useErpLiveMetalSpotPrices()
  const styles = useMemo(() => createStyles(branding), [branding])

  const summary = useMemo(() => {
    if (!enquiry?.account) return null

    const account = enquiry.account
    const metals = enquiry.metals || {}
    const balances = enquiry.balances || {}
    const statementEntries = enquiry.statement?.entries || []
    const { gold: xauBalance, silver: xagBalance } = deriveEnquiryMetalBalances(metals, statementEntries)

    const totalFunds = Number(balances.netBalance ?? 0)
    const enquirySuppressMetalSpotMtm = Boolean(
      metals.suppressMetalSpotMtm || shouldSuppressSpotMetalMtmForAccountEnquiry(account),
    )
    const bookedRevaluation = resolveAccountEnquiryBookedRevaluation(metals, undefined)
    const hasMetalExposure = hasAccountEnquiryMetalExposure(xauBalance, xagBalance)

    const liveMetrics = buildAccountEnquiryLiveMetrics({
      totalFunds,
      goldPosition: xauBalance,
      silverPosition: xagBalance,
      goldPriceUSD,
      silverPriceUSD,
      suppressMetalSpotMtm: enquirySuppressMetalSpotMtm,
      bookedRevaluation,
      liveRecalcEnabled: liveRecalcEnabled && Boolean(enquiry),
    })

    const revaluation = liveMetrics ? liveMetrics.revaluation : 0
    const marginAmount = liveMetrics ? liveMetrics.margin : 0
    const displayMetrics = calculateAccountSummaryMetrics({
      totalFunds,
      revaluation,
      marginAmount,
    })

    const xauSpotValue = xauBalance * goldPriceUSD
    const xagSpotValue = xagBalance * silverPriceUSD

    return {
      accountName: account.accountName || 'Account',
      totalFunds,
      netDirection: balances.netDirection,
      revaluation,
      netEquity: displayMetrics.netEquity,
      marginAmount,
      excess: displayMetrics.excess,
      marginPercent: displayMetrics.marginPercent,
      xauBalance,
      xagBalance,
      xauPrice: goldPriceUSD,
      xagPrice: silverPriceUSD,
      xauSpotValue,
      xagSpotValue,
      hasMetalExposure,
      enquirySuppressMetalSpotMtm,
      liveRecalcEnabled,
    }
  }, [enquiry, goldPriceUSD, silverPriceUSD, liveRecalcEnabled])

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Summary — {accountCode}</Text>
        <Text style={styles.muted}>Loading account summary…</Text>
      </View>
    )
  }

  if (!enquiry?.account || !summary) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Summary — {accountCode}</Text>
        <Text style={styles.muted}>Could not load account summary. Try ledger drilldown.</Text>
      </View>
    )
  }

  const {
    accountName,
    totalFunds,
    netDirection,
    revaluation,
    netEquity,
    marginAmount,
    excess,
    marginPercent,
    xauBalance,
    xagBalance,
    xauPrice,
    xagPrice,
    xauSpotValue,
    xagSpotValue,
    hasMetalExposure,
    enquirySuppressMetalSpotMtm,
    liveRecalcEnabled: liveOn,
  } = summary

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Account Summary — {accountCode}</Text>
        {liveOn && hasMetalExposure ? (
          <Text style={styles.liveBadge}>LIVE MTM</Text>
        ) : null}
      </View>
      <Text style={styles.rowName}>{accountName}</Text>

      <Text style={styles.sectionLabel}>Position</Text>
      <View style={styles.positionRow}>
        <Text style={styles.posType}>XAU</Text>
        <Text style={styles.posCell}>{fmtPosition(xauBalance)} g</Text>
        <Text style={styles.posCell}>{fmt(xauPrice)}</Text>
        <Text style={styles.posCell}>{fmt(xauSpotValue)}</Text>
      </View>
      <View style={styles.positionRow}>
        <Text style={styles.posType}>XAG</Text>
        <Text style={styles.posCell}>{fmtPosition(xagBalance)} g</Text>
        <Text style={styles.posCell}>{fmt(xagPrice)}</Text>
        <Text style={styles.posCell}>{fmt(xagSpotValue)}</Text>
      </View>

      <Text style={styles.sectionLabel}>Summary</Text>
      <SummaryRow label="Total Funds" value={fmtSigned(totalFunds)} direction={netDirection} />
      <SummaryRow label="Revaluation" value={fmt(revaluation)} />
      <SummaryRow label="Net Equity" value={fmtSigned(netEquity)} />
      <SummaryRow label="Margin Amt" value={fmt(marginAmount)} />
      <SummaryRow label="Excess" value={fmtSigned(excess)} />
      <SummaryRow
        label="Margin %"
        value={Number.isFinite(marginPercent) ? `${marginPercent.toFixed(1)}%` : '—'}
      />

      <Text style={styles.footer}>
        {enquirySuppressMetalSpotMtm
          ? 'Creditor/vendor: Total Funds uses ledger payable; revaluation uses booked unfixed metal when posted, otherwise live spot on gram position.'
          : liveOn && hasMetalExposure
            ? 'Revaluation, Net Equity, Margin, and Excess update with live spot when the account has metal exposure. Total Funds stays on the ledger balance.'
            : liveOn && !hasMetalExposure
              ? 'Cash-only: Total Funds stays on the ledger; Revaluation and margin rows stay at 0 while Position Price still updates with live spot.'
              : 'Revaluation and equity update with live spot when the account has metal exposure (grams).'}
      </Text>
    </View>
  )
}

function SummaryRow({
  label,
  value,
  direction,
}: {
  label: string
  value: string
  direction?: string
}) {
  const suffix = direction && label === 'Total Funds' ? ` ${direction}` : ''
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value}>{value}{suffix}</Text>
    </View>
  )
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  label: { fontSize: 13, color: '#374151', fontWeight: '600' },
  value: { fontSize: 13, color: '#111827', fontWeight: '700' },
})

function createStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
    card: {
      marginTop: 16,
      backgroundColor: '#fff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      padding: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: b.colors.text, flex: 1 },
    liveBadge: {
      fontSize: 10,
      fontWeight: '800',
      color: '#059669',
      letterSpacing: 0.5,
    },
    rowName: { fontSize: 14, color: b.colors.text, marginBottom: 8 },
    sectionLabel: {
      marginTop: 10,
      marginBottom: 4,
      fontSize: 12,
      fontWeight: '700',
      color: b.colors.muted,
      textTransform: 'uppercase',
    },
    positionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#F3F4F6',
    },
    posType: { width: 36, fontSize: 12, fontWeight: '700', color: b.colors.text },
    posCell: { flex: 1, fontSize: 12, color: b.colors.text, textAlign: 'right' },
    footer: { marginTop: 10, fontSize: 11, color: b.colors.muted, lineHeight: 16 },
    muted: { color: b.colors.muted, fontSize: 13, marginTop: 8 },
  })
}
