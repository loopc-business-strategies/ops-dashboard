import productionControlApi from '../../../api/productionControl'
import workOrdersApi from '../../../api/production/workOrders'
import { createDemoPccApi, createDemoWorkOrdersApi, DEMO_WRITE_MSG } from './demoApi'

export { createDemoPccApi, createDemoWorkOrdersApi, DEMO_WRITE_MSG }

export function getRealPccApi() {
  return productionControlApi
}

export function getRealWorkOrdersApi() {
  return workOrdersApi
}
