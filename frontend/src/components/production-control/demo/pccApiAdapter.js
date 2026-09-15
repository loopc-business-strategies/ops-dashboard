import productionControlApi from '../../../api/productionControl'
import workOrdersApi from '../../../api/production/workOrders'
import { DEMO_WRITE_MSG } from './demoConstants'

export { DEMO_WRITE_MSG }

export function getRealPccApi() {
  return productionControlApi
}

export function getRealWorkOrdersApi() {
  return workOrdersApi
}
