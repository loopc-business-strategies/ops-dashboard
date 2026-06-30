import { useErpTabBindings } from './useErpTabBindings'
import { useErpTabCoreSlice } from './controllerSlices/useErpTabCoreSlice'
import { useErpTabCatalogSlice } from './controllerSlices/useErpTabCatalogSlice'
import { useErpTabDomainActionsSlice } from './controllerSlices/useErpTabDomainActionsSlice'
import { useErpTabPresentationSlice } from './controllerSlices/useErpTabPresentationSlice'
import { ERP_TAB_SCOPE_STATICS } from './erpTabScopeStatics'

export function useErpTabController({
  focusTab,
  onNavigateMain,
  onErpSubTabChange,
  jumpToTransactionId = null,
  onJumpToTransactionConsumed,
  jumpToVoucher = null,
  onJumpToVoucherConsumed,
  jumpToEnquiryAccountCode = null,
  onJumpToEnquiryConsumed,
}) {
  const core = useErpTabCoreSlice({
    focusTab,
    onNavigateMain,
    onErpSubTabChange,
    jumpToTransactionId,
    onJumpToTransactionConsumed,
    jumpToVoucher,
    onJumpToVoucherConsumed,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
  })
  const catalog = useErpTabCatalogSlice(core)
  const domain = useErpTabDomainActionsSlice({ ...core, ...catalog })
  const presentation = useErpTabPresentationSlice({ ...core, ...catalog, ...domain })
  const scope = {
    ...ERP_TAB_SCOPE_STATICS,
    ...core,
    ...catalog,
    ...domain,
    ...presentation,
  }
  const { panelProps, modalProps } = useErpTabBindings(scope)

  return {
    panelProps,
    modalProps,
    canAccessERP: scope.canAccessERP,
    canViewCurrentErpSubTab: scope.canViewCurrentErpSubTab,
    token: scope.token,
    error: scope.error,
    success: scope.success,
    C: scope.C,
  }
}
