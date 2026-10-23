import {
  useFloatingModalChrome,
} from '../useFloatingModalChrome'

/**
 * Drag + bottom-right resize chrome for the Account Summary modal.
 * Keeps legacy prop names used by ERPTabModals / AccountEnquiryModal.
 */
export function useAccountEnquiryModalDrag(showEnquiryModal) {
  const {
    offset,
    size,
    isDragging,
    isResizing,
    beginDrag,
    beginResize,
    canCloseOnBackdropClick,
  } = useFloatingModalChrome({
    open: showEnquiryModal,
    defaultWidth: 1100,
    defaultHeightRatio: 0.9,
    minWidth: 640,
    minHeight: 420,
    maxHeight: 1400,
  })

  const enquiryBackdropColor = (isDragging || isResizing)
    ? 'rgba(15, 23, 42, 0.12)'
    : 'rgba(15, 23, 42, 0.45)'

  return {
    enquiryModalOffset: offset,
    enquiryModalSize: size,
    enquiryModalDrag: { active: isDragging },
    enquiryModalResizing: isResizing,
    beginEnquiryModalDrag: beginDrag,
    beginEnquiryModalResize: beginResize,
    canCloseEnquiryOnBackdropClick: canCloseOnBackdropClick,
    enquiryBackdropColor,
  }
}
