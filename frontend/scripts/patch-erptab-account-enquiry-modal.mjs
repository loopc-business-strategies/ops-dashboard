import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const erpTabPath = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
const lines = fs.readFileSync(erpTabPath, 'utf8').split(/\r?\n/)

const replacement = `      <AccountEnquiryModal
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
      />`

const startIdx = lines.findIndex((line) => line.includes('ACCOUNT SUMMARY POPUP MODAL - TRADING'))
if (startIdx < 0) throw new Error('modal marker not found')
let endIdx = startIdx + 1
while (endIdx < lines.length && lines[endIdx].trim() !== ')}') endIdx += 1
if (endIdx >= lines.length) throw new Error('modal end not found')

const next = [
  ...lines.slice(0, startIdx),
  '      {/* ACCOUNT SUMMARY POPUP MODAL - TRADING PLATFORM STYLE */}',
  replacement,
  ...lines.slice(endIdx + 1),
]

fs.writeFileSync(erpTabPath, next.join('\n'), 'utf8')
console.log('Replaced modal block', startIdx + 1, '-', endIdx + 1, 'removed', endIdx - startIdx, 'lines')
