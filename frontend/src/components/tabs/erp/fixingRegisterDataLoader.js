import erpAccountingAPI from '../../../api/erp-accounting'

/** Fetch fixing register rows from the server report endpoint (no client multi-page fetch). */
export async function loadFixingRegisterData({ token, fixingRegFilter }) {
  const data = await erpAccountingAPI.getFixingRegisterReport(token, {
    fromDate: fixingRegFilter.fromDate || undefined,
    toDate: fixingRegFilter.toDate || undefined,
    metalType: fixingRegFilter.metalType || undefined,
    status: fixingRegFilter.status || undefined,
    partyFilter: fixingRegFilter.partyFilter || undefined,
    partySearch: fixingRegFilter.partySearch || undefined,
    groupBy: fixingRegFilter.groupBy || undefined,
    orderBy: fixingRegFilter.orderBy || undefined,
    excludeFutures: fixingRegFilter.excludeFutures,
    excludeOpeningBalance: fixingRegFilter.excludeOpeningBalance,
  })
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    opening: data?.opening || { qtyOz: 0, value: 0 },
  }
}
