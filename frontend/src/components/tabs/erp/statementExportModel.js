import {
  DEFAULT_STATEMENT_PRINT,
  STATEMENT_ADDRESS_FONT_MAX,
  STATEMENT_ADDRESS_FONT_MIN,
  STATEMENT_COMPANY_NAME_FONT_MAX,
  STATEMENT_COMPANY_NAME_FONT_MIN,
  clampBrandingDimension,
  clampStatementFontSize,
} from './ERPBrandingUtils'
import { isMasterDocumentSettingsEnabled } from '../../../config/tenantBranding'
import {
  computeStatementExportOpeningBalances,
  matchesStatementMetal,
  resolveStatementMetalBalance,
  resolveStatementSignedAmount,
  sortStatementEntriesForExport,
} from './statementHelpers'

export function formatStatementDocDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short' })
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

export function formatStatementNumber(value, decimals = 2) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatStatementDrCr(value, decimals = 2) {
  const numeric = Number(value || 0)
  return `${formatStatementNumber(Math.abs(numeric), decimals)} ${numeric >= 0 ? 'Dr' : 'Cr'}`
}

export function formatStatementBlankable(value, decimals = 2) {
  const numeric = Number(value || 0)
  if (!numeric) return ''
  return formatStatementNumber(numeric, decimals)
}

export function buildStatementNarration(entry) {
  const primary = String(entry?.description || '').trim()
  if (primary) return primary
  const reference = String(entry?.referenceType || '').trim().toUpperCase()
  const offset = entry?.offsetAccountCode
    ? `${String(entry.offsetAccountCode).trim()}${entry?.offsetAccountName ? ` ${String(entry.offsetAccountName).trim()}` : ''}`
    : ''
  return [reference, offset].filter(Boolean).join(' - ') || 'Statement entry'
}

/**
 * Shared Statement of Account export model for HTML preview/print and jsPDF download.
 * @param {object} ctx — runtime values from ERPTab (account enquiry UI state).
 */
export function buildStatementExportModel(ctx) {
  const {
    accountEnquiryData,
    filteredStatementEntries,
    resolveStatementReceiptNo,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    rawStatementEntries,
    formatStatementDate,
    convertStatementDisplayAmount,
    tenantBranding,
    user,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    statementFilters,
  } = ctx

  if (!accountEnquiryData) return null

  const exportEntries = sortStatementEntriesForExport(filteredStatementEntries, resolveStatementReceiptNo)
  const statementMetalCode = statementSelectedMetalCode || resolvePreferredStatementMetalCode(exportEntries)
  const exportDisplayCurrency = statementDisplayCurrency
  const endingPureWeight = resolveStatementMetalBalance(accountEnquiryData?.metals, statementMetalCode, rawStatementEntries)
  const matchesExportMetalEntry = (entry) => matchesStatementMetal(entry, statementMetalCode)

  // Prefer server runningBalance from the newest visible row so dated/truncated windows
  // match the on-screen table instead of full-history netBalance.
  const newestVisibleEntry = [...exportEntries].sort((left, right) => {
    const leftTime = new Date(left?.date || 0).getTime()
    const rightTime = new Date(right?.date || 0).getTime()
    if (rightTime !== leftTime) return rightTime - leftTime
    return String(right?._id || '').localeCompare(String(left?._id || ''))
  })[0]
  const serverClosingBalance = Number(newestVisibleEntry?.runningBalance)
  const closingNetBalance = Number.isFinite(serverClosingBalance)
    ? serverClosingBalance
    : accountEnquiryData?.balances?.netBalance

  const {
    openingUsdBalance,
    openingPureWeight,
    closingUsdBalance,
    closingPureWeight,
  } = computeStatementExportOpeningBalances({
    exportEntries,
    closingNetBalance,
    closingPureWeight: endingPureWeight,
    matchesMetalEntry: matchesExportMetalEntry,
  })

  let runningUsdBalance = openingUsdBalance
  let runningPureWeight = openingPureWeight
  const entryRows = exportEntries.map((entry) => {
    const debitUsd = Number(entry?.debitAmount || 0)
    const creditUsd = Number(entry?.creditAmount || 0)
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    const isSelectedMetalEntry = matchesStatementMetal(entry, statementMetalCode)
    const debitPure = isSelectedMetalEntry && signedPureWeight > 0 ? signedPureWeight : 0
    const creditPure = isSelectedMetalEntry && signedPureWeight < 0 ? Math.abs(signedPureWeight) : 0
    runningUsdBalance += resolveStatementSignedAmount(entry)
    if (isSelectedMetalEntry) runningPureWeight += signedPureWeight
    return {
      kind: 'entry',
      cells: [
        resolveStatementReceiptNo(entry) || '-',
        formatStatementDocDate(entry.date) || formatStatementDate(entry.date) || '-',
        buildStatementNarration(entry),
        formatStatementBlankable(convertStatementDisplayAmount(debitUsd), 2),
        formatStatementBlankable(convertStatementDisplayAmount(creditUsd), 2),
        formatStatementDrCr(convertStatementDisplayAmount(runningUsdBalance), 2),
        formatStatementBlankable(debitPure, 3),
        formatStatementBlankable(creditPure, 3),
        formatStatementDrCr(runningPureWeight, 3),
      ],
    }
  })

  const totalDebitUsd = exportEntries.reduce((sum, entry) => sum + Number(entry?.debitAmount || 0), 0)
  const totalCreditUsd = exportEntries.reduce((sum, entry) => sum + Number(entry?.creditAmount || 0), 0)
  const totalDebitPure = exportEntries.reduce((sum, entry) => {
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    return sum + (matchesExportMetalEntry(entry) && signedPureWeight > 0 ? signedPureWeight : 0)
  }, 0)
  const totalCreditPure = exportEntries.reduce((sum, entry) => {
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    return sum + (matchesExportMetalEntry(entry) && signedPureWeight < 0 ? Math.abs(signedPureWeight) : 0)
  }, 0)

  const openingRow = {
    kind: 'opening',
    cells: [
      '',
      '',
      'Balance B/F',
      '',
      '',
      formatStatementDrCr(convertStatementDisplayAmount(openingUsdBalance), 2),
      '',
      '',
      formatStatementDrCr(openingPureWeight, 3),
    ],
  }
  const closingRow = {
    kind: 'closing',
    cells: [
      '',
      '',
      'Balance C/F',
      formatStatementBlankable(convertStatementDisplayAmount(totalDebitUsd), 2),
      formatStatementBlankable(convertStatementDisplayAmount(totalCreditUsd), 2),
      formatStatementDrCr(convertStatementDisplayAmount(closingUsdBalance), 2),
      formatStatementBlankable(totalDebitPure, 3),
      formatStatementBlankable(totalCreditPure, 3),
      formatStatementDrCr(closingPureWeight, 3),
    ],
  }

  const tableRows = [openingRow, ...entryRows, closingRow]
  const head = [
    [
      { content: 'Doc No', rowSpan: 2 },
      { content: 'Doc Date', rowSpan: 2 },
      { content: 'Narration', rowSpan: 2 },
      { content: `Amount (${exportDisplayCurrency})`, colSpan: 3 },
      { content: `${statementMetalCode}(GMS)`, colSpan: 3 },
    ],
    ['Debit', 'Credit', 'Balance', 'Debit', 'Credit', 'Balance'],
  ]

  const tenantIdentity = [
    tenantBranding?.key,
    tenantBranding?.displayName,
    user?.tenant?.key,
    user?.tenant?.name,
    user?.company,
    branding?.companyName,
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ')
  const isModernGoldStatement = /\bmg\b/.test(tenantIdentity) || tenantIdentity.includes('modern gold')
  const tenantKey = String(tenantBranding?.key || user?.company || user?.tenant?.key || '').trim().toLowerCase()
  const useMasterStatementLayout = isMasterDocumentSettingsEnabled(tenantKey)
  const statementPrint = branding?.statementPrint || {}
  const statementTitle = String(statementPrint.title || 'Statement of Account').trim() || 'Statement of Account'
  const statementSubtitle = String(statementPrint.subtitle || '').trim()
  const statementFooterNote = String(statementPrint.footerNote || '').trim()
  const visibleStatementSignatories = (Array.isArray(statementPrint.signatories) ? statementPrint.signatories : [])
    .filter((item) => item?.visible !== false)
  const showPrintNote = statementPrint.showPrintNote !== false
  const logoOffsetX = Number(statementPrint.logoOffsetX || 0)
  const logoOffsetY = Number(statementPrint.logoOffsetY || 0)
  const logoTransparent = statementPrint.logoTransparent !== false
  const companyNameFontSize = clampStatementFontSize(
    statementPrint.companyNameFontSize,
    DEFAULT_STATEMENT_PRINT.companyNameFontSize,
    STATEMENT_COMPANY_NAME_FONT_MIN,
    STATEMENT_COMPANY_NAME_FONT_MAX,
  )
  const addressFontSize = clampStatementFontSize(
    statementPrint.addressFontSize,
    DEFAULT_STATEMENT_PRINT.addressFontSize,
    STATEMENT_ADDRESS_FONT_MIN,
    STATEMENT_ADDRESS_FONT_MAX,
  )
  const brandingProfile = {
    ...branding,
    companyName: !useMasterStatementLayout && isModernGoldStatement && (!branding.companyName || branding.companyName === DEFAULT_BRANDING.companyName)
      ? 'MODERN GOLD JEWELRY MANUFACTURING'
      : branding.companyName,
  }
  const companyAddress = String(brandingProfile.address || '').trim()
  const companyPhone = String(brandingProfile.phone || '').trim()
  const companyTrn = String(brandingProfile.trn || '').trim()
  const accountAddress = String(accountEnquiryData?.account?.address || accountEnquiryData?.account?.description || '').trim()
  const headerStartDate = statementFilters?.startDate || exportEntries[0]?.date || ''
  const headerEndDate = statementFilters?.endDate || exportEntries[exportEntries.length - 1]?.date || ''
  const statementLogoWidth = !useMasterStatementLayout && isModernGoldStatement && brandingProfile.logoUrl
    ? Math.max(110, clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260))
    : clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const statementLogoHeight = !useMasterStatementLayout && isModernGoldStatement && brandingProfile.logoUrl
    ? Math.max(90, clampBrandingDimension(brandingProfile.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120))
    : clampBrandingDimension(brandingProfile.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)

  return {
    accountCode: accountEnquiryData.account.accountCode,
    accountName: accountEnquiryData.account.accountName || 'Account',
    accountAddress,
    currency: exportDisplayCurrency,
    metalCode: statementMetalCode,
    title: statementTitle,
    subtitle: statementSubtitle,
    footerNote: statementFooterNote,
    showPrintNote,
    companyName: brandingProfile.companyName || DEFAULT_BRANDING.companyName,
    companyAddress,
    companyPhone,
    companyTrn,
    dateFromLabel: formatStatementDocDate(headerStartDate) || '-',
    dateToLabel: formatStatementDocDate(headerEndDate) || '-',
    printedByName: user?.name || 'User',
    logoUrl: brandingProfile.logoUrl,
    logoFit: brandingProfile.logoFit || 'contain',
    logoWidth: statementLogoWidth,
    logoHeight: statementLogoHeight,
    logoOffsetX,
    logoOffsetY,
    logoTransparent,
    companyNameFontSize,
    addressFontSize,
    useMasterStatementLayout,
    isModernGoldStatement,
    signatories: visibleStatementSignatories,
    defaultCompanyName: DEFAULT_BRANDING.companyName,
    head,
    tableRows,
    body: tableRows.map((row) => row.cells),
  }
}
