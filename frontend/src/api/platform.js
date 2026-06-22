import axios, { API_ORIGIN } from './client'

const cfg = () => ({ withCredentials: true })

/** Public tenant list (company codes) for mobile login and setup pages. */
const getPublicTenants = async () =>
  (await axios.get(`${API_ORIGIN}/api/platform/tenants/public`)).data

/** LoopC super_admin: registered tenants, custom domains, onboarding checklist. */
const getTenantCatalog = async () =>
  (await axios.get(`${API_ORIGIN}/api/admin/tenants/catalog`, cfg())).data

const platformAPI = { getPublicTenants, getTenantCatalog }

export default platformAPI
