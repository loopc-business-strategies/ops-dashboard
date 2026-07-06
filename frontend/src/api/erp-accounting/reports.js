import { BASE, axios, getAuthConfig } from './client'

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

const getTrialBalance = async (token, params) => (await axios.get(`${BASE}/reports/trial-balance`, getAuthConfig(token, params))).data
const getLedgerReport = async (token, params) => (await axios.get(`${BASE}/reports/ledger`, getAuthConfig(token, params))).data
const getDashboardReport = async (token, params = {}) => (await axios.get(`${BASE}/reports/dashboard`, getAuthConfig(token, params))).data
const getMarketPrices = async (token, params = {}) => (await axios.get(`${BASE}/reports/market-prices`, getAuthConfig(token, params))).data
const getMarketPricesStreamUrl = (params = {}) => `${BASE}/reports/market-prices/stream${buildQueryString(params)}`
const getProfitLossReport = async (token, params) => (await axios.get(`${BASE}/reports/profit-loss`, getAuthConfig(token, params))).data
const getBalanceSheetReport = async (token, params) => (await axios.get(`${BASE}/reports/balance-sheet`, getAuthConfig(token, params))).data
const getDayBookReport = async (token, params) => (await axios.get(`${BASE}/reports/day-book`, getAuthConfig(token, params))).data
const getCustomerOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/customer-outstanding`, getAuthConfig(token, params))).data
const getVendorOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/vendor-outstanding`, getAuthConfig(token, params))).data
const getForexGainLossReport = async (token, params) => (await axios.get(`${BASE}/reports/forex-gain-loss`, getAuthConfig(token, params))).data

const cleanExpenseRegisterParams = (params = {}) => {
  const out = {}
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'paymentSource' && value === 'all') return
    out[key] = value
  })
  return out
}

const getExpenseRegister = async (token, params = {}) => (
  await axios.get(`${BASE}/reports/expense-register`, getAuthConfig(token, cleanExpenseRegisterParams(params)))
).data

export const reportsApi = {
  getTrialBalance,
  getLedgerReport,
  getDashboardReport,
  getMarketPrices,
  getMarketPricesStreamUrl,
  getProfitLossReport,
  getBalanceSheetReport,
  getDayBookReport,
  getCustomerOutstandingReport,
  getVendorOutstandingReport,
  getForexGainLossReport,
  getExpenseRegister,
  cleanExpenseRegisterParams,
}
