import fs from 'node:fs'

const path = 'frontend/src/components/tabs/ERPTab.jsx'
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)

const start = lines.findIndex((l) => l.includes('const enquiryComputationEnabled = activeTab'))
const end = lines.findIndex((l, i) => i > start && l.includes('const transactionPageCount = Math.max'))
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
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
  const {
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryBackdropColor,
  } = useAccountEnquiryModalDrag(showEnquiryModal)`.split('\n')

lines.splice(start, end - start, ...hookBlock)

const dragStart = lines.findIndex((l) => l.includes('const enquiryBackdropColor = enquiryModalDrag.active'))
const fixStart = lines.findIndex((l) => l.includes('const beginFixingRegPanelDrag = (event)'))
if (dragStart >= 0 && fixStart > dragStart) {
  let effectEnd = fixStart
  for (let i = dragStart; i < fixStart; i++) {
    if (lines[i].startsWith('  useEffect(() => {') && lines.slice(i, i + 8).join('').includes('showEnquiryModal')) {
      for (let j = i; j < fixStart; j++) {
        if (lines[j].includes('}, [showEnquiryModal, enquiryModalDrag])')) {
          effectEnd = j + 1
          break
        }
      }
    }
  }
  lines.splice(dragStart, effectEnd - dragStart)
}

fs.writeFileSync(path, lines.join('\n'))
console.log('Patched ERPTab enquiry hooks')
