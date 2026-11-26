import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/alloy-mix-jobs`

/** MG Floor alloy mix custody — allocate + incoming receive (same APIs as the tablet). */
export const mgFloorAlloyMixApi = {
  list: async (params = {}) => (await axios.get(BASE, { params })).data,
  allocate: async (id, payload = {}) => (
    await axios.post(`${BASE}/${encodeURIComponent(id)}/allocate`, payload || {})
  ).data,
  receive: async (id, payload = {}) => (
    await axios.post(`${BASE}/${encodeURIComponent(id)}/receive`, payload || {})
  ).data,
  /** Vault Room only: add catalog metal onto an in-vault mix. */
  addMetal: async (id, payload = {}) => (
    await axios.post(`${BASE}/${encodeURIComponent(id)}/add-metal`, payload || {})
  ).data,
  /** Vault Room only: transfer full or partial in-vault mix into Finished Jewelry & Inventory. */
  transferFinished: async (id, payload = {}) => (
    await axios.post(`${BASE}/${encodeURIComponent(id)}/transfer-finished`, payload || {})
  ).data,
  listInventoryProducts: async () => (
    await axios.get(`${API_ORIGIN}/api/mg-floor/inventory-products`)
  ).data,
}
