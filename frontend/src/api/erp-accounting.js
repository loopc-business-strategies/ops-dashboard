import axios from 'axios'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE = `${API_ORIGIN}/api/erp-accounting`

// Helper to get auth config
const getAuthConfig = (_token, params = null) => {
  const config = {
    withCredentials: true,
  }
  if (params) config.params = params
  return config
}

// Chart of Accounts
const getAccounts = async (token, params) => (await axios.get(`${BASE}/accounts`, getAuthConfig(token, params))).data
const getAccount = async (token, id) => (await axios.get(`${BASE}/accounts/${id}`, getAuthConfig(token))).data
const getAccountEnquiry = async (token, accountCode, params = {}) => (await axios.get(`${BASE}/accounts/enquiry`, getAuthConfig(token, { accountCode, ...params }))).data
const createAccount = async (token, payload) => (await axios.post(`${BASE}/accounts`, payload, getAuthConfig(token))).data
const updateAccount = async (token, id, payload) => (await axios.put(`${BASE}/accounts/${id}`, payload, getAuthConfig(token))).data
const deleteAccount = async (token, id) => (await axios.delete(`${BASE}/accounts/${id}`, getAuthConfig(token))).data

// Customers
const getCustomers = async (token, params) => (await axios.get(`${BASE}/customers`, getAuthConfig(token, params))).data
const createCustomer = async (token, payload) => (await axios.post(`${BASE}/customers`, payload, getAuthConfig(token))).data
const updateCustomer = async (token, id, payload) => (await axios.put(`${BASE}/customers/${id}`, payload, getAuthConfig(token))).data
const deleteCustomer = async (token, id) => (await axios.delete(`${BASE}/customers/${id}`, getAuthConfig(token))).data
const getCustomerAging = async (token, id) => (await axios.get(`${BASE}/customers/${id}/aging`, getAuthConfig(token))).data

// Ledger
const getLedger = async (token, params) => (await axios.get(`${BASE}/ledger`, getAuthConfig(token, params))).data
const createLedgerEntry = async (token, payload) => (await axios.post(`${BASE}/ledger`, payload, getAuthConfig(token))).data
const updateLedgerEntry = async (token, id, payload) => (await axios.put(`${BASE}/ledger/${id}`, payload, getAuthConfig(token))).data
const deleteLedgerEntry = async (token, id) => (await axios.delete(`${BASE}/ledger/${id}`, getAuthConfig(token))).data
const permanentDeleteLedgerEntry = async (token, id) => (await axios.delete(`${BASE}/ledger/${id}/permanent`, getAuthConfig(token))).data

// Account Mappings
const getMappings = async (token, params) => (await axios.get(`${BASE}/mappings`, getAuthConfig(token, params))).data
const createMapping = async (token, payload) => (await axios.post(`${BASE}/mappings`, payload, getAuthConfig(token))).data
const updateMapping = async (token, id, payload) => (await axios.put(`${BASE}/mappings/${id}`, payload, getAuthConfig(token))).data
const deleteMapping = async (token, id) => (await axios.delete(`${BASE}/mappings/${id}`, getAuthConfig(token))).data

// Currencies
const getCurrencies = async (token) => (await axios.get(`${BASE}/currencies`, getAuthConfig(token))).data
const createCurrency = async (token, payload) => (await axios.post(`${BASE}/currencies`, payload, getAuthConfig(token))).data
const updateCurrency = async (token, id, payload) => (await axios.put(`${BASE}/currencies/${id}`, payload, getAuthConfig(token))).data
const deleteCurrency = async (token, id) => (await axios.delete(`${BASE}/currencies/${id}`, getAuthConfig(token))).data
const seedDefaultCurrencies = async (token) => (await axios.post(`${BASE}/currencies/seed-defaults`, {}, getAuthConfig(token))).data
const getReportBranding = async (token, params) => (await axios.get(`${BASE}/report-branding`, getAuthConfig(token, params))).data
const updateReportBranding = async (token, payload) => (await axios.put(`${BASE}/report-branding`, payload, getAuthConfig(token))).data
const getMetalRates = async (token) => (await axios.get(`${BASE}/metal-rates`, getAuthConfig(token))).data
const updateMetalRates = async (token, payload) => (await axios.put(`${BASE}/metal-rates`, payload, getAuthConfig(token))).data

// Direct Deals (Fixing / Non-Fixing)
const getDirectDeals = async (token, params) => (await axios.get(`${BASE}/direct-deals`, getAuthConfig(token, params))).data
const createDirectDeal = async (token, payload) => (await axios.post(`${BASE}/direct-deals`, payload, getAuthConfig(token))).data
const updateDirectDeal = async (token, id, payload) => (await axios.put(`${BASE}/direct-deals/${id}`, payload, getAuthConfig(token))).data
const deleteDirectDeal = async (token, id) => (await axios.delete(`${BASE}/direct-deals/${id}`, getAuthConfig(token))).data

// Transactions
const getTransactions = async (token, params) => (await axios.get(`${BASE}/transactions`, getAuthConfig(token, params))).data
const createTransaction = async (token, payload) => (await axios.post(`${BASE}/transactions`, payload, getAuthConfig(token))).data
const updateTransaction = async (token, id, payload) => (await axios.put(`${BASE}/transactions/${id}`, payload, getAuthConfig(token))).data
const deleteTransaction = async (token, id) => (await axios.delete(`${BASE}/transactions/${id}`, getAuthConfig(token))).data
const submitTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/submit`, payload, getAuthConfig(token))).data
const approveTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/approve`, payload, getAuthConfig(token))).data
const returnTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/return`, payload, getAuthConfig(token))).data
const rejectTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/reject`, payload, getAuthConfig(token))).data
const postTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/post`, payload, getAuthConfig(token))).data
const addTransactionComment = async (token, id, payload) => (await axios.post(`${BASE}/transactions/${id}/comments`, payload, getAuthConfig(token))).data
const uploadTransactionAttachment = async (token, id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return (await axios.post(`${BASE}/transactions/${id}/attachments`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data
}
const deleteTransactionAttachment = async (token, id, attachmentId) => (await axios.delete(`${BASE}/transactions/${id}/attachments/${attachmentId}`, getAuthConfig(token))).data
const bulkTransactionAction = async (token, payload) => (await axios.post(`${BASE}/transactions/bulk-action`, payload, getAuthConfig(token))).data
const getTransactionSourceByLedger = async (token, ledgerId) => (await axios.get(`${BASE}/transactions/source-by-ledger/${ledgerId}`, getAuthConfig(token))).data

// Vendors
const getVendors = async (token, params) => (await axios.get(`${BASE}/vendors`, getAuthConfig(token, params))).data
const getVendorDetails = async (token, id) => (await axios.get(`${BASE}/vendors/${id}/details`, getAuthConfig(token))).data
const updateVendorWorkflow = async (token, id, payload) => (await axios.post(`${BASE}/vendors/${id}/workflow`, payload, getAuthConfig(token))).data
const getVendorDocuments = async (token, id) => (await axios.get(`${BASE}/vendors/${id}/documents`, getAuthConfig(token))).data
const addVendorDocument = async (token, id, payload) => (await axios.post(`${BASE}/vendors/${id}/documents`, payload, getAuthConfig(token))).data
const updateVendorDocument = async (token, id, documentId, payload) => (await axios.put(`${BASE}/vendors/${id}/documents/${documentId}`, payload, getAuthConfig(token))).data
const deleteVendorDocument = async (token, id, documentId) => (await axios.delete(`${BASE}/vendors/${id}/documents/${documentId}`, getAuthConfig(token))).data
const getVendorPaymentCalendar = async (token, params) => (await axios.get(`${BASE}/vendors/payment-calendar`, getAuthConfig(token, params))).data
const getVendorComplianceSummary = async (token, params) => (await axios.get(`${BASE}/vendors/compliance-summary`, getAuthConfig(token, params))).data
const getVendorOverdueAlertQueue = async (token, params) => (await axios.get(`${BASE}/vendors/alerts/overdue-queue`, getAuthConfig(token, params))).data
const createVendor = async (token, payload) => (await axios.post(`${BASE}/vendors`, payload, getAuthConfig(token))).data
const updateVendor = async (token, id, payload) => (await axios.put(`${BASE}/vendors/${id}`, payload, getAuthConfig(token))).data
const deleteVendor = async (token, id) => (await axios.delete(`${BASE}/vendors/${id}`, getAuthConfig(token))).data

// Inventory
const getInventoryProducts = async (token) => (await axios.get(`${BASE}/inventory/products`, getAuthConfig(token))).data
const createInventoryProduct = async (token, payload) => (await axios.post(`${BASE}/inventory/products`, payload, getAuthConfig(token))).data
const updateInventoryProduct = async (token, id, payload) => (await axios.put(`${BASE}/inventory/products/${id}`, payload, getAuthConfig(token))).data
const deleteInventoryProduct = async (token, id) => (await axios.delete(`${BASE}/inventory/products/${id}`, getAuthConfig(token))).data
const stockInInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-in`, payload, getAuthConfig(token))).data
const stockOutInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-out`, payload, getAuthConfig(token))).data
const getStockLedger = async (token) => (await axios.get(`${BASE}/inventory/stock-ledger`, getAuthConfig(token))).data

// Reports
const getTrialBalance = async (token, params) => (await axios.get(`${BASE}/reports/trial-balance`, getAuthConfig(token, params))).data
const getLedgerReport = async (token, params) => (await axios.get(`${BASE}/reports/ledger`, getAuthConfig(token, params))).data
const getDashboardReport = async (token, params = {}) => (await axios.get(`${BASE}/reports/dashboard`, getAuthConfig(token, params))).data
const getProfitLossReport = async (token, params) => (await axios.get(`${BASE}/reports/profit-loss`, getAuthConfig(token, params))).data
const getBalanceSheetReport = async (token, params) => (await axios.get(`${BASE}/reports/balance-sheet`, getAuthConfig(token, params))).data
const getDayBookReport = async (token, params) => (await axios.get(`${BASE}/reports/day-book`, getAuthConfig(token, params))).data
const getCustomerOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/customer-outstanding`, getAuthConfig(token, params))).data
const getVendorOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/vendor-outstanding`, getAuthConfig(token, params))).data
const getForexGainLossReport = async (token, params) => (await axios.get(`${BASE}/reports/forex-gain-loss`, getAuthConfig(token, params))).data

const erpAccountingAPI = {
  getAccounts,
  getAccount,
  getAccountEnquiry,
  createAccount,
  updateAccount,
  deleteAccount,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerAging,
  getLedger,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  permanentDeleteLedgerEntry,
  getMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  getCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  seedDefaultCurrencies,
  getReportBranding,
  updateReportBranding,
  getMetalRates,
  updateMetalRates,
  getDirectDeals,
  createDirectDeal,
  updateDirectDeal,
  deleteDirectDeal,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  submitTransaction,
  approveTransaction,
  returnTransaction,
  rejectTransaction,
  postTransaction,
  addTransactionComment,
  uploadTransactionAttachment,
  deleteTransactionAttachment,
  bulkTransactionAction,
  getTransactionSourceByLedger,
  getVendors,
  getVendorDetails,
  updateVendorWorkflow,
  getVendorDocuments,
  addVendorDocument,
  updateVendorDocument,
  deleteVendorDocument,
  getVendorPaymentCalendar,
  getVendorComplianceSummary,
  getVendorOverdueAlertQueue,
  createVendor,
  updateVendor,
  deleteVendor,
  getInventoryProducts,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  stockInInventory,
  stockOutInventory,
  getStockLedger,
  getTrialBalance,
  getLedgerReport,
  getDashboardReport,
  getProfitLossReport,
  getBalanceSheetReport,
  getDayBookReport,
  getCustomerOutstandingReport,
  getVendorOutstandingReport,
  getForexGainLossReport,
}

export default erpAccountingAPI
