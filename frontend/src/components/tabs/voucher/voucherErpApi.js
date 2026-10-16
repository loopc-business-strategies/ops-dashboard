import erpAccountingAPI from '../../../api/erp-accounting'
import { buildMetalRatesFromApiPayload, marketPricesToRates } from '../../../utils/liveMetalRates'
import { CATALOG_KINDS } from '../../../utils/erpCatalogCache'
import { loadSharedPagedList } from '../../../utils/erpPagedRows'
import { loadSharedAccountChart } from '../../../utils/erpSharedAccountChart'

/** Voucher tab ERP API facade — routes all /api/erp-accounting calls through erpAccountingAPI. */

export async function fetchVoucherParties(token, { onPage } = {}) {
  let customers = []
  let vendors = []
  const publish = () => onPage?.({ customers, vendors })
  await Promise.all([
    loadSharedPagedList({
      cacheKind: CATALOG_KINDS.customers,
      token,
      params: { all: true, sharedPages: true },
      pageSize: 100,
      readPage: async ({ page, limit }) => {
        const res = await erpAccountingAPI.getCustomers(token, { page, limit })
        return { rows: res.customers || [], total: res.total }
      },
      onPage: (rows) => {
        customers = rows
        publish()
      },
    }),
    loadSharedPagedList({
      cacheKind: CATALOG_KINDS.vendors,
      token,
      params: { all: true, sharedPages: true },
      pageSize: 100,
      readPage: async ({ page, limit }) => {
        const res = await erpAccountingAPI.getVendors(token, { page, limit })
        return { rows: res.vendors || [], total: res.total }
      },
      onPage: (rows) => {
        vendors = rows
        publish()
      },
    }),
  ])
  return { customers, vendors }
}

export async function fetchVoucherAccounts(token, { onPage } = {}) {
  return loadSharedAccountChart(token, { onPage })
}

export async function fetchVoucherCurrencies(token) {
  const res = await erpAccountingAPI.getCurrencies(token)
  return Array.isArray(res?.currencies) ? res.currencies : []
}

export async function fetchVoucherMetalRates(token) {
  try {
    const liveRes = await erpAccountingAPI.getLiveMetalRates(token)
    const liveRates = liveRes?.rates
    const lg = Number(liveRates?.goldPrice) || 0
    const ls = Number(liveRates?.silverPrice) || 0
    const lp = Number(liveRates?.platinumPrice) || 0
    if (liveRes?.success && liveRes?.live && liveRates && lg > 0 && ls > 0 && lp > 0) {
      return buildMetalRatesFromApiPayload(liveRates)
    }
  } catch {
    // fall through
  }

  try {
    const marketRes = await erpAccountingAPI.getMarketPrices(token, { currency: 'USD', unit: 'toz', fresh: 1 })
    const marketRates = marketPricesToRates(marketRes)
    const mg = Number(marketRates?.goldPrice) || 0
    const ms = Number(marketRates?.silverPrice) || 0
    const mp = Number(marketRates?.platinumPrice) || 0
    if (marketRates && mg > 0 && ms > 0 && mp > 0) {
      return buildMetalRatesFromApiPayload(marketRates)
    }
  } catch {
    // Some roles can read vouchers but not reports.
  }

  const savedRes = await erpAccountingAPI.getMetalRates(token)
  if (savedRes?.success && savedRes?.rates) {
    return buildMetalRatesFromApiPayload(savedRes.rates)
  }
  return null
}

export async function fetchVoucherTransactions(token, params) {
  const res = await erpAccountingAPI.getTransactions(token, params)
  return res
}

export async function fetchVoucherInventoryProducts(token, params = {}) {
  const { search, ...apiParams } = params || {}
  const res = await erpAccountingAPI.getInventoryProducts(token, { limit: 500, ...apiParams })
  if (search) {
    const q = String(search).trim().toLowerCase()
    const products = Array.isArray(res?.products) ? res.products : []
    return { ...res, products: products.filter((p) => JSON.stringify(p).toLowerCase().includes(q)) }
  }
  return res
}

const WORKFLOW_ACTIONS = {
  submit: 'submitTransaction',
  approve: 'approveTransaction',
  return: 'returnTransaction',
  reject: 'rejectTransaction',
  post: 'postTransaction',
}

export async function runVoucherWorkflowAction(token, transactionId, action, body = {}) {
  const method = WORKFLOW_ACTIONS[action]
  if (!method) throw new Error(`Unknown voucher workflow action: ${action}`)
  return erpAccountingAPI[method](token, transactionId, body)
}

export {
  erpAccountingAPI as voucherErpApi,
}
