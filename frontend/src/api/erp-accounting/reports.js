import { BASE, axios, getAuthConfig } from './client'

const getTrialBalance = async (token, params) => (await axios.get(`${BASE}/reports/trial-balance`, getAuthConfig(token, params))).data
const getLedgerReport = async (token, params) => (await axios.get(`${BASE}/reports/ledger`, getAuthConfig(token, params))).data
const getDashboardReport = async (token, params = {}) => (await axios.get(`${BASE}/reports/dashboard`, getAuthConfig(token, params))).data
const getProfitLossReport = async (token, params) => (await axios.get(`${BASE}/reports/profit-loss`, getAuthConfig(token, params))).data
const getBalanceSheetReport = async (token, params) => (await axios.get(`${BASE}/reports/balance-sheet`, getAuthConfig(token, params))).data
const getDayBookReport = async (token, params) => (await axios.get(`${BASE}/reports/day-book`, getAuthConfig(token, params))).data
const getCustomerOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/customer-outstanding`, getAuthConfig(token, params))).data
const getVendorOutstandingReport = async (token, params) => (await axios.get(`${BASE}/reports/vendor-outstanding`, getAuthConfig(token, params))).data
const getForexGainLossReport = async (token, params) => (await axios.get(`${BASE}/reports/forex-gain-loss`, getAuthConfig(token, params))).data

export const reportsApi = {
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