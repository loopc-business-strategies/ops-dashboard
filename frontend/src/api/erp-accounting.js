import { accountsApi } from './erp-accounting/accounts'
import { currenciesApi } from './erp-accounting/currencies'
import { customersApi } from './erp-accounting/customers'
import { directDealsApi } from './erp-accounting/directDeals'
import { inventoryApi } from './erp-accounting/inventory'
import { ledgerApi } from './erp-accounting/ledger'
import { mappingsApi } from './erp-accounting/mappings'
import { reportsApi } from './erp-accounting/reports'
import { transactionsApi } from './erp-accounting/transactions'
import { vendorsApi } from './erp-accounting/vendors'

const erpAccountingAPI = {
  ...accountsApi,
  ...customersApi,
  ...ledgerApi,
  ...mappingsApi,
  ...currenciesApi,
  ...directDealsApi,
  ...transactionsApi,
  ...vendorsApi,
  ...inventoryApi,
  ...reportsApi,
}

export default erpAccountingAPI
