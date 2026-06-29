import inventoryApi from './inventory'
import workOrdersApi from '../production/workOrders'
import procurementApi from '../procurement'

/** Operations ERP surface — legacy /api/erp routes, tenant-scoped via cookie session. */
export default {
  ...inventoryApi,
  ...workOrdersApi,
  ...procurementApi,
}

export { inventoryApi, workOrdersApi, procurementApi }
