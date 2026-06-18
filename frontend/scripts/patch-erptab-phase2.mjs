import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
let text = fs.readFileSync(file, 'utf8')
const lines = text.split(/\r?\n/)

function replaceRange(start, end, replacementLines) {
  const before = lines.slice(0, start - 1)
  const after = lines.slice(end)
  const next = [...before, ...replacementLines, ...after]
  return next.join('\n')
}

const customersReplacement = [
  "      {activeTab === 'customers' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPCustomersTab',
  '            C={C}',
  '            canManageCustomers={canManageCustomers}',
  '            showCustomerForm={showCustomerForm}',
  '            setShowCustomerForm={setShowCustomerForm}',
  '            customerForm={customerForm}',
  '            setCustomerForm={setCustomerForm}',
  '            handleCreateCustomer={handleCreateCustomer}',
  '            saving={saving}',
  '            customers={customers}',
  '            handleEditCustomer={handleEditCustomer}',
  '            handleDeleteCustomer={handleDeleteCustomer}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const customerMarginReplacement = [
  "      {activeTab === 'customer-margin' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPCustomerMarginTab',
  '            C={C}',
  '            setActiveTabGuarded={setActiveTabGuarded}',
  '            customerMarginSort={customerMarginSort}',
  '            setCustomerMarginSort={setCustomerMarginSort}',
  '            customerMarginCompactView={customerMarginCompactView}',
  '            setCustomerMarginCompactView={setCustomerMarginCompactView}',
  '            customerMarginSearch={customerMarginSearch}',
  '            setCustomerMarginSearch={setCustomerMarginSearch}',
  '            customerMarginRows={customerMarginRows}',
  '            handleCustomerMarginRowContextMenu={handleCustomerMarginRowContextMenu}',
  '            customerMarginContextMenu={customerMarginContextMenu}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const supplierMarginReplacement = [
  "      {activeTab === 'supplier-margin' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPSupplierMarginTab',
  '            C={C}',
  '            setActiveTabGuarded={setActiveTabGuarded}',
  '            supplierMarginSort={supplierMarginSort}',
  '            setSupplierMarginSort={setSupplierMarginSort}',
  '            supplierMarginCompactView={supplierMarginCompactView}',
  '            setSupplierMarginCompactView={setSupplierMarginCompactView}',
  '            supplierMarginSearch={supplierMarginSearch}',
  '            setSupplierMarginSearch={setSupplierMarginSearch}',
  '            supplierMarginRows={supplierMarginRows}',
  '            handleSupplierMarginRowContextMenu={handleSupplierMarginRowContextMenu}',
  '            supplierMarginContextMenu={supplierMarginContextMenu}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const mappingsReplacement = [
  "      {activeTab === 'mappings' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPMappingsTab',
  '            C={C}',
  '            canManageAccounts={canManageAccounts}',
  '            showMappingForm={showMappingForm}',
  '            setShowMappingForm={setShowMappingForm}',
  '            mappingFilters={mappingFilters}',
  '            setMappingFilters={setMappingFilters}',
  '            LEDGER_DEPARTMENTS={LEDGER_DEPARTMENTS}',
  '            mappingSummary={mappingSummary}',
  '            getDepartmentBadgeStyle={getDepartmentBadgeStyle}',
  '            mappingForm={mappingForm}',
  '            setMappingForm={setMappingForm}',
  '            accounts={accounts}',
  '            handleCreateMapping={handleCreateMapping}',
  '            saving={saving}',
  '            mappings={mappings}',
  '            sorting={sorting}',
  '            setSorting={setSorting}',
  '            pagination={pagination}',
  '            setPagination={setPagination}',
  '            ITEMS_PER_PAGE={ITEMS_PER_PAGE}',
  '            token={token}',
  '            loadMappings={loadMappings}',
  '            showNotification={showNotification}',
  '            setError={setError}',
  '            setTestMapping={setTestMapping}',
  '            setShowMappingTest={setShowMappingTest}',
  '            handleEditMapping={handleEditMapping}',
  '            handleDeleteMapping={handleDeleteMapping}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const enquiryReplacement = [
  "      {activeTab === 'enquiry' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPEnquiryTab',
  '            activeTab={activeTab}',
  '            C={C}',
  '            isSuperAdmin={isSuperAdmin}',
  '            isFinance={isFinance}',
  '            canViewBalanceEnquiry={canViewBalanceEnquiry}',
  '            handleAccountEnquiry={handleAccountEnquiry}',
  '            accountEnquiryCode={accountEnquiryCode}',
  '            setAccountEnquiryCode={setAccountEnquiryCode}',
  '            setEnquiryStatus={setEnquiryStatus}',
  '            filteredGroupedSummaryAccounts={filteredGroupedSummaryAccounts}',
  '            fetchAccountEnquiryByCode={fetchAccountEnquiryByCode}',
  '            enquiryLoading={enquiryLoading}',
  '            enquiryStatus={enquiryStatus}',
  '            summaryAccountsLoading={summaryAccountsLoading}',
  '            safeSummaryAccounts={safeSummaryAccounts}',
  '            enquiryHistory={enquiryHistory}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const settingsReplacement = [
  "      {activeTab === 'settings' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPSettingsTab',
  '            C={C}',
  '            selectedBrandingKey={selectedBrandingKey}',
  '            setSelectedBrandingKey={setSelectedBrandingKey}',
  '            handleSelectBrandingProfile={handleSelectBrandingProfile}',
  '            brandingProfiles={brandingProfiles}',
  '            brandingForm={brandingForm}',
  '            setBrandingForm={setBrandingForm}',
  '            handleBrandingLogoFile={handleBrandingLogoFile}',
  '            saving={saving}',
  '            canManageAccounts={canManageAccounts}',
  '            handleSaveBranding={handleSaveBranding}',
  '            inventoryStockCodeSettings={inventoryStockCodeSettings}',
  '            setInventoryStockCodeSettings={setInventoryStockCodeSettings}',
  '            handleCreateBrandingDraft={handleCreateBrandingDraft}',
  '            brandingPreviewLogo={brandingPreviewLogo}',
  '            brandingPreview={brandingPreview}',
  '          />',
  '        </Suspense>',
  '      )}',
]

const currenciesReplacement = [
  "      {activeTab === 'currencies' && (",
  '        <Suspense fallback={<ErpSubTabFallback />}>',
  '          <ERPCurrenciesTab',
  '            C={C}',
  '            erpBaseCurrencyCode={erpBaseCurrencyCode}',
  '            canManageAccounts={canManageAccounts}',
  '            showCurrencyForm={showCurrencyForm}',
  '            setShowCurrencyForm={setShowCurrencyForm}',
  '            handleSyncCurrencyMaster={handleSyncCurrencyMaster}',
  '            saving={saving}',
  '            setActiveTabGuarded={setActiveTabGuarded}',
  '            usdConversion={usdConversion}',
  '            setUsdConversion={setUsdConversion}',
  '            usdToTargetAmount={usdToTargetAmount}',
  '            selectedUsdConversionRate={selectedUsdConversionRate}',
  '            currencyForm={currencyForm}',
  '            setCurrencyForm={setCurrencyForm}',
  '            handleCreateCurrency={handleCreateCurrency}',
  '            currencies={currencies}',
  '            handleEditCurrency={handleEditCurrency}',
  '            handleDeleteCurrency={handleDeleteCurrency}',
  '          />',
  '        </Suspense>',
  '      )}',
]

// Apply from bottom to top so line numbers stay valid
const ranges = [
  [6562, 6766, currenciesReplacement],
  [6235, 6560, settingsReplacement],
  [5880, 6008, enquiryReplacement],
  [5704, 5878, mappingsReplacement],
  [5476, 5612, supplierMarginReplacement],
  [5338, 5474, customerMarginReplacement],
  [5250, 5336, customersReplacement],
]

let out = lines
for (const [start, end, replacement] of ranges) {
  out = [...out.slice(0, start - 1), ...replacement, ...out.slice(end)]
}

text = out.join('\n')

// Remove inline formatCustomerMargin* functions
text = text.replace(/\n  const formatCustomerMarginEquity[\s\S]*?\n  const handleCustomerMarginRowContextMenu/, '\n  const handleCustomerMarginRowContextMenu')

// Add lazy imports after ERPFixingRegisterTab line
const lazyImports = `const ERPCustomersTab = lazy(() => import('./erp/tabs/ERPCustomersTab'))
const ERPCustomerMarginTab = lazy(() => import('./erp/tabs/ERPCustomerMarginTab'))
const ERPSupplierMarginTab = lazy(() => import('./erp/tabs/ERPSupplierMarginTab'))
const ERPMappingsTab = lazy(() => import('./erp/tabs/ERPMappingsTab'))
const ERPEnquiryTab = lazy(() => import('./erp/tabs/ERPEnquiryTab'))
const ERPSettingsTab = lazy(() => import('./erp/tabs/ERPSettingsTab'))
const ERPCurrenciesTab = lazy(() => import('./erp/tabs/ERPCurrenciesTab'))
`
if (!text.includes('ERPCustomersTab = lazy')) {
  text = text.replace(
    "const ERPFixingRegisterTab = lazy(() => import('./erp/tabs/ERPFixingRegisterTab'))",
    `const ERPFixingRegisterTab = lazy(() => import('./erp/tabs/ERPFixingRegisterTab'))
${lazyImports}`,
  )
}

// Add hook imports
const hookImports = `import { useErpCustomers } from './erp/useErpCustomers'
import { useErpMappings } from './erp/useErpMappings'
import { useErpCurrencies } from './erp/useErpCurrencies'
`
if (!text.includes('useErpCustomers')) {
  text = text.replace(
    "import { useErpMetalRatesRealtime } from './erp/useErpMetalRatesRealtime'",
    `import { useErpMetalRatesRealtime } from './erp/useErpMetalRatesRealtime'
${hookImports}`,
  )
}

fs.writeFileSync(file, text, 'utf8')
console.log('Patched ERPTab.jsx, new line count:', text.split(/\r?\n/).length)
