/**
 * Unified ERP entry point — routes callers to the correct API surface.
 *
 * - **Accounting ERP** (`erp-accounting`): ledger, vouchers, GL inventory, reports
 * - **Operations ERP** (`erp`): suppliers, POs, work orders, ops alerts
 *
 * See docs/ERP-API-GUIDE.md
 */

import erpAccountingAPI from './erp-accounting'
import erpOpsAPI from './erp'

export const ERP_SURFACE = {
  ACCOUNTING: 'accounting',
  OPERATIONS: 'operations',
}

/** @param {'accounting'|'operations'} surface */
export function getErpClient(surface) {
  if (surface === ERP_SURFACE.OPERATIONS) return erpOpsAPI
  return erpAccountingAPI
}

export default {
  accounting: erpAccountingAPI,
  operations: erpOpsAPI,
  getErpClient,
  ERP_SURFACE,
}
