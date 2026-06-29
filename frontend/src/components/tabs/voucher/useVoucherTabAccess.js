import { isVoucherTypeEnabled } from '../../../config/tenantBranding'
import { resolveErpUserTenantBranding } from '../erp/resolveErpUserTenant'
import { deriveErpAccessPolicy, canCreateTransactionFor } from '../erp/accessPolicy'
import { VOUCHER_TAB_TYPES } from './voucherTabConstants'

export function useVoucherTabAccess(user) {
  const erpAccess = deriveErpAccessPolicy(user || {})
  const tenantBranding = resolveErpUserTenantBranding(user)
  const tenantKey = tenantBranding?.key || ''
  const enabledVoucherTypes = VOUCHER_TAB_TYPES.filter((type) => isVoucherTypeEnabled(tenantKey, type))

  return {
    erpAccess,
    tenantKey,
    enabledVoucherTypes,
    isSuperAdmin: erpAccess.isSuperAdmin,
    isFinance: erpAccess.isFinance,
    isManagementOnly: erpAccess.isManagementRole,
    canManageWorkflow: erpAccess.canManageTransactionWorkflow,
    canView: erpAccess.canAccessVouchers || erpAccess.canAccessTransactions,
    canCreatePayment: isVoucherTypeEnabled(tenantKey, 'payment') && canCreateTransactionFor(user || {}, 'payment'),
    canCreateReceipt: isVoucherTypeEnabled(tenantKey, 'receipt') && canCreateTransactionFor(user || {}, 'receipt'),
    canCreatePurchase: isVoucherTypeEnabled(tenantKey, 'purchase') && canCreateTransactionFor(user || {}, 'purchase'),
    canCreateSale: isVoucherTypeEnabled(tenantKey, 'sale') && canCreateTransactionFor(user || {}, 'sale'),
    canCreateMetalReceipt: isVoucherTypeEnabled(tenantKey, 'metal_receipt') && canCreateTransactionFor(user || {}, 'metal_receipt'),
    canCreateMetalPayment: isVoucherTypeEnabled(tenantKey, 'metal_payment') && canCreateTransactionFor(user || {}, 'metal_payment'),
    isReadOnly: erpAccess.isManagementRole && !erpAccess.canCreateTransaction,
  }
}
