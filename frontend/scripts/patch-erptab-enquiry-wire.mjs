/**
 * Wire account enquiry hooks + AccountEnquiryModal into ERPTab.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const erpTabPath = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
let src = fs.readFileSync(erpTabPath, 'utf8')

if (!src.includes('useAccountEnquiryStatement')) {
  src = src.replace(
    "import { useJournalVoucher } from './erp/useJournalVoucher'",
    `import { useJournalVoucher } from './erp/useJournalVoucher'
import AccountEnquiryModal from './erp/accountEnquiry/AccountEnquiryModal'
import { useAccountEnquiryStatement } from './erp/accountEnquiry/useAccountEnquiryStatement'
import { useAccountEnquiryModalDrag } from './erp/accountEnquiry/useAccountEnquiryModalDrag'`,
  )
}

src = src.replace(
  `  const [enquiryModalOffset, setEnquiryModalOffset] = useState({ x: 0, y: 0 })
  const [enquiryModalDrag, setEnquiryModalDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
`,
  '',
)

const marginBlockStart = src.indexOf('  const {\n    customerMarginSearch,')
const marginBlockEnd = src.indexOf('  useErpMarginContextMenuDismissal({', marginBlockStart)
const marginEnd = src.indexOf('  })', marginBlockEnd) + 5
if (marginBlockStart < 0 || marginBlockEnd < 0) {
  console.error('margin block not found')
  process.exit(1)
}
const marginBlock = src.slice(marginBlockStart, marginEnd)

const enquiryStart = src.indexOf('  const enquiryComputationEnabled = activeTab')
const enquiryEnd = src.indexOf('  const transactionPageCount = Math.max', enquiryStart)
if (enquiryStart < 0 || enquiryEnd < 0) {
  console.error('enquiry block not found', enquiryStart, enquiryEnd)
  process.exit(1)
}

const hookBlock = `  const {
    goldPriceUSD,
    silverPriceUSD,
    rawStatementEntries,
    baseCurrencyCode,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    statementFilterCurrencyOptions,
    statementDisplayCurrencyOptions,
    statementMetalOptions,
    statementReferenceTypes,
    statementDepartments,
    filteredStatementEntries,
    modalPositionRows,
    formatStatementValue,
    formatStatementNullableValue,
    getSignedColor,
    convertStatementDisplayAmount,
    resolveStatementReceiptNo,
    resolveMetalCode,
    pureWeightRunningByEntryKey,
    formatStatementDate,
    recentPaymentReceiptEntry,
    unfixedMetalEntries,
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
  } = useAccountEnquiryStatement({
    activeTab,
    showEnquiryModal,
    accountEnquiryData,
    statementFilters,
    statementMetalCommodityEnabled,
    erpLiveMetalSnapshot,
    metalRates,
    erpBaseCurrencyCode,
    currencies,
    inventoryStockTypeOptions,
    convertJvAmount,
  })
${marginBlock}
  const {
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryBackdropColor,
  } = useAccountEnquiryModalDrag(showEnquiryModal)
`

src = src.slice(0, enquiryStart) + hookBlock + '\n' + src.slice(enquiryEnd)

const dragLegacy = `  const enquiryBackdropColor = enquiryModalDrag.active ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.45)'
  const beginEnquiryModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setEnquiryModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: enquiryModalOffset.x,
      startY: enquiryModalOffset.y,
    })
  }
`
if (src.includes(dragLegacy)) {
  src = src.replace(dragLegacy, '')
}

const enquiryDragEffect = `  useEffect(() => {
    if (!showEnquiryModal) {
      setEnquiryModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setEnquiryModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!enquiryModalDrag.active) return undefined
    const handlePointerMove = (event) => {
      setEnquiryModalOffset({
        x: enquiryModalDrag.startX + (event.clientX - enquiryModalDrag.pointerX),
        y: enquiryModalDrag.startY + (event.clientY - enquiryModalDrag.pointerY),
      })
    }
    const handlePointerUp = () => {
      setEnquiryModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [showEnquiryModal, enquiryModalDrag])
`
if (src.includes(enquiryDragEffect)) {
  src = src.replace(enquiryDragEffect, '')
}

if (!src.includes('<AccountEnquiryModal')) {
  const lines = src.split(/\r?\n/)
  const startIdx = lines.findIndex((line) => line.includes('ACCOUNT SUMMARY POPUP MODAL - TRADING'))
  if (startIdx < 0) throw new Error('modal marker not found')
  let endIdx = startIdx + 1
  while (endIdx < lines.length && lines[endIdx].trim() !== ')}') endIdx += 1
  if (endIdx >= lines.length) throw new Error('modal end not found')

  const replacement = `      {/* ACCOUNT SUMMARY POPUP MODAL - TRADING PLATFORM STYLE */}
      <AccountEnquiryModal
        open={showEnquiryModal}
        onClose={() => setShowEnquiryModal(false)}
        enquiryBackdropColor={enquiryBackdropColor}
        enquiryModalOffset={enquiryModalOffset}
        enquiryModalDrag={enquiryModalDrag}
        beginEnquiryModalDrag={beginEnquiryModalDrag}
        enquiryLoading={enquiryLoading}
        accountEnquiryCode={accountEnquiryCode}
        setAccountEnquiryCode={setAccountEnquiryCode}
        setShowEnquiryLookupMenu={setShowEnquiryLookupMenu}
        showEnquiryLookupMenu={showEnquiryLookupMenu}
        filteredGroupedSummaryAccounts={filteredGroupedSummaryAccounts}
        setEnquiryStatus={setEnquiryStatus}
        fetchAccountEnquiryByCode={fetchAccountEnquiryByCode}
        enquiryStatus={enquiryStatus}
        accountEnquiryData={accountEnquiryData}
        modalPositionRows={modalPositionRows}
        formatStatementValue={formatStatementValue}
        getSignedColor={getSignedColor}
        formatDirectionalBalance={formatDirectionalBalance}
        unfixedMetalEntries={unfixedMetalEntries}
        formatStatementDate={formatStatementDate}
        fixedMetalSummary={fixedMetalSummary}
        unfixedMetalSummary={unfixedMetalSummary}
        unknownFixMetalEntries={unknownFixMetalEntries}
        modalTotalFundsDisplay={modalTotalFundsDisplay}
        modalRevaluationDisplay={modalRevaluationDisplay}
        modalNetEquityDisplay={modalNetEquityDisplay}
        modalMarginAmtDisplay={modalMarginAmtDisplay}
        modalExcessDisplay={modalExcessDisplay}
        modalMarginPctDisplay={modalMarginPctDisplay}
        enquirySuppressMetalSpotMtm={enquirySuppressMetalSpotMtm}
        excessCurrency={excessCurrency}
        setExcessCurrency={setExcessCurrency}
        baseCurrencyCode={baseCurrencyCode}
        statementDisplayCurrencyOptions={statementDisplayCurrencyOptions}
        filteredStatementEntries={filteredStatementEntries}
        recentPaymentReceiptEntry={recentPaymentReceiptEntry}
        resolveStatementReceiptNo={resolveStatementReceiptNo}
        statementFilters={statementFilters}
        setStatementFilters={setStatementFilters}
        statementReferenceTypes={statementReferenceTypes}
        statementDepartments={statementDepartments}
        setStatementMetalCommodityEnabled={setStatementMetalCommodityEnabled}
        statementMetalCommodityEnabled={statementMetalCommodityEnabled}
        statementFilterCurrencyOptions={statementFilterCurrencyOptions}
        statementMetalOptions={statementMetalOptions}
        statementDisplayCurrency={statementDisplayCurrency}
        showStatementAuditIds={showStatementAuditIds}
        setShowStatementAuditIds={setShowStatementAuditIds}
        statementTableRef={statementTableRef}
        convertStatementDisplayAmount={convertStatementDisplayAmount}
        resolveMetalCode={resolveMetalCode}
        statementSelectedMetalCode={statementSelectedMetalCode}
        pureWeightRunningByEntryKey={pureWeightRunningByEntryKey}
        formatStatementNullableValue={formatStatementNullableValue}
        canExportAccountSummary={canExportAccountSummary}
        handleViewStatement={handleViewStatement}
        handleExportEnquiryPdf={handleExportEnquiryPdf}
        getAccountEnquirySignedMetricColor={getAccountEnquirySignedMetricColor}
        formatAccountEnquiryExcessDisplay={formatAccountEnquiryExcessDisplay}
        resolveExposureDirection={resolveExposureDirection}
        isMetalStatementEntry={isMetalStatementEntry}
      />`.split('\n')

  src = [...lines.slice(0, startIdx), ...replacement, ...lines.slice(endIdx + 1)].join('\n')
}

fs.writeFileSync(erpTabPath, src, 'utf8')
console.log('Wired account enquiry hooks + modal')
