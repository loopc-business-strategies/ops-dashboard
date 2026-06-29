import erpAccountingAPI from '../../../api/erp-accounting'
import { buildMetalRatesFromApiPayload, marketPricesToRates } from '../../../utils/liveMetalRates'

/** Voucher tab ERP API facade — routes all /api/erp-accounting calls through erpAccountingAPI. */

export async function fetchVoucherParties(token) {
  const [custRes, vendRes] = await Promise.all([
    erpAccountingAPI.getCustomers(token, { limit: 500 }),
    erpAccountingAPI.getVendors(token, { limit: 500 }),
  ])
  return {
    customers: custRes.customers || [],
    vendors: vendRes.vendors || [],
  }
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

export async function fetchVoucherInventoryProducts(token, params) {
  const res = await erpAccountingAPI.getInventoryProducts(token)
  if (params?.search) {
    const q = String(params.search).trim().toLowerCase()
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
