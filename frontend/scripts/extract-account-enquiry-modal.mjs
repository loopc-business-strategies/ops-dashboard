import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const erpTabPath = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
const outPath = path.join(__dirname, '../src/components/tabs/erp/accountEnquiry/AccountEnquiryModal.jsx')
const lines = fs.readFileSync(erpTabPath, 'utf8').split(/\r?\n/)
const body = lines.slice(5945, 6467).join('\n')

const header = `import { ERP_TAB_COLORS as C, ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'

export default function AccountEnquiryModal({
  open,
  onClose,
  enquiryBackdropColor,
  enquiryModalOffset,
  enquiryModalDrag,
  beginEnquiryModalDrag,
  enquiryLoading,
  accountEnquiryCode,
  setAccountEnquiryCode,
  setShowEnquiryLookupMenu,
  showEnquiryLookupMenu,
  filteredGroupedSummaryAccounts,
  setEnquiryStatus,
  fetchAccountEnquiryByCode,
  enquiryStatus,
  accountEnquiryData,
  modalPositionRows,
  formatStatementValue,
  getSignedColor,
  formatDirectionalBalance,
  unfixedMetalEntries,
  formatStatementDate,
  fixedMetalSummary,
  unfixedMetalSummary,
  unknownFixMetalEntries,
  modalTotalFundsDisplay,
  modalRevaluationDisplay,
  modalNetEquityDisplay,
  modalMarginAmtDisplay,
  modalExcessDisplay,
  modalMarginPctDisplay,
  enquirySuppressMetalSpotMtm,
  excessCurrency,
  setExcessCurrency,
  baseCurrencyCode,
  statementDisplayCurrencyOptions,
  filteredStatementEntries,
  recentPaymentReceiptEntry,
  resolveStatementReceiptNo,
  statementFilters,
  setStatementFilters,
  statementReferenceTypes,
  statementDepartments,
  setStatementMetalCommodityEnabled,
  statementMetalCommodityEnabled,
  statementFilterCurrencyOptions,
  statementMetalOptions,
  statementDisplayCurrency,
  showStatementAuditIds,
  setShowStatementAuditIds,
  statementTableRef,
  convertStatementDisplayAmount,
  resolveMetalCode,
  statementSelectedMetalCode,
  pureWeightRunningByEntryKey,
  formatStatementNullableValue,
  canExportAccountSummary,
  handleViewStatement,
  handleExportEnquiryPdf,
  getAccountEnquirySignedMetricColor,
  formatAccountEnquiryExcessDisplay,
  resolveExposureDirection,
  isMetalStatementEntry,
}) {
  if (!open) return null
  return (
`

const footer = `
  )
}
`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, header + body + footer, 'utf8')
console.log('Wrote', outPath)
