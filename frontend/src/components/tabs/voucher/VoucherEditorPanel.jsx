import React, { useCallback, useEffect, useRef } from 'react'
import AccountCombobox from '../../AccountCombobox'
import VoucherAttachmentsPanel from '../erp/VoucherAttachmentsPanel'
import {
  S, btn, fmt, inputStyle, labelStyle, tabBtn, sectionBox, sectionHeader, sectionBody,
  classicHeaderShell, classicHeaderGrid, classicPanel, classicPanelTitle, classicPartyGrid,
  classicPartyCodeRow, classicPartySearchBtn, classicPartySummary, classicPartyTypeTag,
  classicRightGrid, classicLabel, classicInput, classicReadInput, metalWin,
  normalizeLineType, isMetalStockVoucherType, getInventoryCatalogProductsForStock,
  productTransferTabBtn, productTransferDocHeader, productTransferDocField, productTransferDocLabel,
  productTransferDocInput, productTransferDocDateInput, productTransferSectionBox,
  productTransferSectionBody, productTransferFooter, productTransferActionBtn,
} from './voucherTabShared'
import {
  focusElement,
  handleRecommendedTab,
  shouldSkipAutofilledAmountLc,
} from './voucherKeyboardNav'
import MetalTransferEditor from './MetalTransferEditor'
import VoucherToolbarIcon from './VoucherToolbarIcon'
import { buildNetAmountRows } from './voucherNetAmounts'

export default function VoucherEditorPanel({
  applyLineAutoCalc,
  applyProductTypeAutoFill,
  attachmentInputKey,
  baseCurrencyCode,
  canCreate,
  canDeleteCurrentVoucher,
  canRejectWorkflow,
  canReturnWorkflow,
  canRevalueCurrentVoucher,
  canSubmitWorkflow,
  cancelLine,
  currencyOptions,
  currentAttachments,
  currentVoucher,
  currentVoucherStatus,
  editingId,
  editingLineIdx,
  error = '',
  formReadOnly,
  entryLockInfo = null,
  handleAddLineClick,
  handleAmountFC,
  handleAmountLC,
  handleDeleteLineClick,
  handleDeleteVoucher,
  handleDeleteVoucherAttachment,
  handleEditLineClick,
  handleEditUnlock,
  handleExitVoucherForm,
  handleHeaderCurrRateChange,
  handleHeaderCurrencyChange,
  handleLineAcCodeChange,
  handleLineAmountEnter,
  handleLineCurrencyChange,
  handleLineTypeChange,
  handleModalHeaderMouseDown,
  handlePartyCodeEnter,
  handlePartySelect,
  handlePreviewVoucherAttachment,
  handleRevalueFxJournal,
  handleSearchFind,
  handleStockSelection,
  handleUploadVoucherAttachments,
  handleVoucherModalBackdropClick,
  handleWorkflowAction,
  header,
  inventoryProducts,
  inventoryStockOptions,
  isMetalVoucher,
  isReadOnly,
  isSimpleMetalVoucher,
  isProductTransferVoucher = false,
  keyboardNavEnabled = false,
  lineAccountComboGroups,
  lineForm,
  lineItems,
  setLineItems,
  lineTableHeaders,
  loadingInventoryProducts,
  loadingRecentPartyVouchers,
  menuTab,
  metalPartyComboGroups,
  modalDrag,
  modalOffset,
  mode,
  navFirst,
  navLast,
  navNext,
  navPrev,
  openAddLine,
  openCreate,
  onPrintPreview,
  partyComboGroups,
  receiptPaymentNetAmtLabelCurrency,
  voucherNetAmounts = null,
  recentPartyVouchers,
  resolveVoucherParty,
  runToolbarAction,
  saveLine,
  saveVoucher,
  saving,
  searchPartyByCode,
  selectedPartyId,
  setHdr,
  setLF,
  setLineForm,
  setMenuTab,
  setMode,
  setWorkflowNote,
  showAccountDetailsTab,
  showLineForm,
  t,
  totals,
  voucherCode,
  voucherConfig,
  voucherLabel,
  voucherLabelT,
  voucherType,
  vouchers,
  workflowNote,
}) {
  const partyAccountRef = useRef(null)
  const partyCodeRef = useRef(null)
  const docDateRef = useRef(null)
  const valueDateRef = useRef(null)
  const headerCurrRef = useRef(null)
  const headerRateRef = useRef(null)
  const headerPriceRef = useRef(null)
  const fixingTypeRef = useRef(null)
  const addLineBtnRef = useRef(null)
  const lineTypeRef = useRef(null)
  const lineAcCodeRef = useRef(null)
  const lineRefRateRef = useRef(null)
  const lineAmtFcRef = useRef(null)
  const lineAmtLcRef = useRef(null)
  const lineNarrationRef = useRef(null)
  const lineSaveBtnRef = useRef(null)
  const metalStockRef = useRef(null)
  const metalProductRef = useRef(null)
  const metalPcsRef = useRef(null)
  const metalGrossRef = useRef(null)
  const metalPurityRef = useRef(null)
  const metalPureRef = useRef(null)
  const metalOzRef = useRef(null)
  const metalRateTypeRef = useRef(null)
  const metalMakingRateRef = useRef(null)
  const metalPurityDiffRef = useRef(null)
  const metalPremCurrRef = useRef(null)
  const metalPremiumRef = useRef(null)
  const metalRateTypeTextRef = useRef(null)
  const metalLineRateRef = useRef(null)
  const metalMakingRef = useRef(null)
  const metalTaxRef = useRef(null)
  const metalSaveBtnRef = useRef(null)
  const metalClearBtnRef = useRef(null)
  const transferFromProductRef = useRef(null)
  const transferFromPcsRef = useRef(null)
  const transferFromGrossRef = useRef(null)
  const transferToProductRef = useRef(null)
  const transferToPcsRef = useRef(null)
  const saveVoucherBtnRef = useRef(null)
  const cancelVoucherBtnRef = useRef(null)
  const pendingFocusLineFieldRef = useRef(false)

  const showRefRate = ['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())
    && String(lineForm.currCode || 'USD').toUpperCase() !== baseCurrencyCode

  const isProfessionalMetal = isMetalVoucher && !isSimpleMetalVoucher && !isProductTransferVoucher

  const getProfessionalMetalNavOrder = useCallback(() => ([
    partyCodeRef,
    partyAccountRef,
    fixingTypeRef,
    docDateRef,
    valueDateRef,
    headerCurrRef,
    headerRateRef,
    headerPriceRef,
    metalStockRef,
    metalProductRef,
    metalGrossRef,
    metalPurityRef,
    metalPureRef,
    metalOzRef,
    metalPcsRef,
    metalRateTypeRef,
    metalMakingRateRef,
    metalPurityDiffRef,
    metalPremCurrRef,
    metalPremiumRef,
    metalRateTypeTextRef,
    metalLineRateRef,
    metalMakingRef,
    metalSaveBtnRef,
    metalClearBtnRef,
    metalTaxRef,
    lineNarrationRef,
    saveVoucherBtnRef,
    cancelVoucherBtnRef,
  ]), [])

  const getSimpleMetalNavOrder = useCallback(() => ([
    partyCodeRef,
    partyAccountRef,
    docDateRef,
    metalStockRef,
    metalProductRef,
    metalPcsRef,
    metalGrossRef,
    metalPurityRef,
    metalPureRef,
    metalSaveBtnRef,
    metalClearBtnRef,
    lineNarrationRef,
    saveVoucherBtnRef,
    cancelVoucherBtnRef,
  ]), [])

  const getCashEntryNavOrder = useCallback(() => ([
    partyCodeRef,
    partyAccountRef,
    docDateRef,
    valueDateRef,
    headerCurrRef,
    headerRateRef,
    lineTypeRef,
    lineAcCodeRef,
    ...(showRefRate ? [lineRefRateRef] : []),
    lineAmtFcRef,
    lineAmtLcRef,
    addLineBtnRef,
    lineSaveBtnRef,
    lineNarrationRef,
    saveVoucherBtnRef,
    cancelVoucherBtnRef,
  ]), [showRefRate])

  const getTransferNavOrder = useCallback(() => ([
    docDateRef,
    transferFromProductRef,
    transferFromPcsRef,
    transferFromGrossRef,
    transferToProductRef,
    transferToPcsRef,
    saveVoucherBtnRef,
    cancelVoucherBtnRef,
  ]), [])

  const getHeaderNavOrder = useCallback(() => {
    if (isProfessionalMetal) return getProfessionalMetalNavOrder()
    if (isSimpleMetalVoucher) return getSimpleMetalNavOrder()
    if (isProductTransferVoucher) return getTransferNavOrder()
    return getCashEntryNavOrder()
  }, [isProfessionalMetal, isSimpleMetalVoucher, isProductTransferVoucher, getProfessionalMetalNavOrder, getSimpleMetalNavOrder, getTransferNavOrder, getCashEntryNavOrder])

  const getCashLineNavOrder = useCallback(() => getCashEntryNavOrder(), [getCashEntryNavOrder])

  const getMetalLineNavOrder = useCallback(() => (
    isProfessionalMetal ? getProfessionalMetalNavOrder() : getSimpleMetalNavOrder()
  ), [isProfessionalMetal, getProfessionalMetalNavOrder, getSimpleMetalNavOrder])

  const handleHeaderNavKeyDown = useCallback((e) => {
    if (!keyboardNavEnabled || formReadOnly) return
    handleRecommendedTab(e, {
      enabled: true,
      order: getHeaderNavOrder,
      onBeforeMove: (_evt, { nextIndex, wrapForward }) => {
        const order = getHeaderNavOrder()
        const movingToAdd = wrapForward || order[nextIndex] === addLineBtnRef || order[nextIndex] === metalSaveBtnRef
        if (movingToAdd && !showLineForm) {
          pendingFocusLineFieldRef.current = true
          handleAddLineClick()
        }
      },
    })
  }, [keyboardNavEnabled, formReadOnly, getHeaderNavOrder, handleAddLineClick, showLineForm])

  const handleCashLineNavKeyDown = useCallback((e) => {
    if (!keyboardNavEnabled || formReadOnly) return
    // Keep Enter → save on amount fields
    if (e.key === 'Enter') {
      handleLineAmountEnter(e)
      return
    }
    handleRecommendedTab(e, {
      enabled: true,
      order: getCashLineNavOrder,
      skipPred: (el) => {
        const lcEl = lineAmtLcRef.current
        if (el !== lcEl) return false
        return shouldSkipAutofilledAmountLc(lineForm.amountLC, lineForm.amountFC)
      },
    })
  }, [keyboardNavEnabled, formReadOnly, getCashLineNavOrder, handleLineAmountEnter, lineForm.amountFC, lineForm.amountLC])

  const handleMetalLineNavKeyDown = useCallback((e) => {
    if (!keyboardNavEnabled || formReadOnly) return
    handleRecommendedTab(e, {
      enabled: true,
      order: getMetalLineNavOrder,
    })
  }, [keyboardNavEnabled, formReadOnly, getMetalLineNavOrder])

  useEffect(() => {
    if (!keyboardNavEnabled || !showLineForm || !pendingFocusLineFieldRef.current) return
    pendingFocusLineFieldRef.current = false
    const timer = setTimeout(() => {
      if (isMetalVoucher) focusElement(metalStockRef)
      else focusElement(lineTypeRef)
    }, 40)
    return () => clearTimeout(timer)
  }, [keyboardNavEnabled, showLineForm, isMetalVoucher])

  const cashSingleView = !isMetalVoucher && !isProductTransferVoucher
  const compactHeader = !isProductTransferVoucher
  const stockLabelCell = {
    padding: '0 0.4rem',
    fontSize: '0.72rem',
    background: S.headerBg,
    display: 'flex',
    alignItems: 'center',
    height: 28,
    minWidth: 0,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${S.border}`,
    borderRight: `1px solid ${S.border}`,
    boxSizing: 'border-box',
  }
  const stockFieldCell = {
    ...inputStyle,
    border: 0,
    borderRadius: 0,
    borderBottom: `1px solid ${S.border}`,
    borderRight: `1px solid ${S.border}`,
    padding: '0 0.35rem',
    height: 28,
    minHeight: 28,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    fontSize: '0.75rem',
  }

  useEffect(() => {
    if (!compactHeader || formReadOnly || showLineForm) return
    if (mode !== 'create' && mode !== 'view') return
    openAddLine()
  }, [compactHeader, formReadOnly, showLineForm, mode, editingId, openAddLine])

  return (
    <>
      {/* ═══════════════════════════════════════════════════════ CREATE / VIEW MODE */}
      {(mode === 'create' || mode === 'view') && (
        <div
          style={(mode === 'create' || mode === 'view')
            ? {
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem',
              }
            : undefined}
          onClick={(mode === 'create' || mode === 'view') ? handleVoucherModalBackdropClick : undefined}
        >
          <div
            style={(mode === 'create' || mode === 'view')
              ? {
                  width: cashSingleView
                    ? 'min(760px, 94vw)'
                    : (isMetalVoucher && !isSimpleMetalVoucher ? 'min(1080px, 96vw)' : 'min(860px, 94vw)'),
                  maxHeight: 'calc(100vh - 0.45rem)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  background: S.white,
                  borderRadius: '0.7rem',
                  border: '2px solid #4F73AB',
                  boxShadow: '0 16px 32px rgba(15, 23, 42, 0.48), inset 0 1px 0 rgba(255,255,255,0.2)',
                  padding: '0',
                  transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)`,
                }
              : undefined}
            onClick={(mode === 'create' || mode === 'view') ? (e) => e.stopPropagation() : undefined}
          >
          {/* ── Top title bar ── */}
          {/* ── ERP-style Title Bar (draggable) ── */}
          <div
            style={{
              background: 'var(--grad-brand)',
              color: '#fff',
              padding: '4px 8px 5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(0,0,0,0.15)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
              borderRadius: '0.5rem 0.5rem 0 0',
              marginBottom: 0,
              flexShrink: 0,
              cursor: mode === 'create' ? (modalDrag ? 'grabbing' : 'grab') : 'default',
              userSelect: mode === 'create' ? 'none' : 'auto',
            }}
            onMouseDown={mode === 'create' ? handleModalHeaderMouseDown : undefined}
          >
            <div style={{ width: 84 }} />
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'center', letterSpacing: '.2px', textShadow: '0 1px 0 rgba(0,0,0,0.28)' }}>
              {voucherLabelT}{header.vocNo ? ` — #${header.vocNo}` : ''}
            </span>
            <div className="voucher-win-controls" style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="voucher-win-btn" aria-label="Minimize" title="Minimize">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
              <button type="button" className="voucher-win-btn" aria-label="Maximize" title="Maximize">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
              </button>
              <button
                type="button"
                className="voucher-win-btn voucher-win-btn-close"
                title="Close"
                aria-label="Close"
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  e.stopPropagation()
                  handleExitVoucherForm()
                }}
                onClick={(e) => {
                  e.preventDefault()
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>

          {/* ── ERP Classic Toolbar ── */}
          {(() => {
            const tbS = {
              width: 30,
              height: 26,
              background: '#F8FAFC',
              border: '1px solid #A9A9A9',
              borderTop: '1px solid #F8F8F8',
              borderLeft: '1px solid #ECECEC',
              borderRadius: 2,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 1px 1px 1px rgba(0,0,0,0.22)',
              color: '#222',
              padding: 0,
              flexShrink: 0,
            }
            const TbBtn = ({ tip, label, icon, onClick, style: extra = {}, disabled = false }) => (
              <button
                type="button"
                title={tip}
                aria-label={label}
                onMouseDown={disabled ? undefined : (e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  e.stopPropagation()
                  runToolbarAction(label || tip || 'Action', () => onClick?.(e))
                }}
                onClick={(e) => {
                  e.preventDefault()
                }}
                disabled={disabled}
                style={{ ...tbS, ...extra, ...(disabled ? { opacity: 0.35, cursor: 'default', pointerEvents: 'none' } : { pointerEvents: 'auto' }) }}
              >
                <VoucherToolbarIcon name={icon} />
              </button>
            )
            const Sep = () => <div style={{ width: 1, height: 20, background: '#b0b0b0', margin: '0 3px', flexShrink: 0 }} />
            const curIdx = vouchers.findIndex(v => v._id === editingId)
            return (
              <div style={{
                background: isMetalVoucher
                  ? '#FFFFFF'
                  : '#FFFFFF',
                borderBottom: isMetalVoucher ? '2px solid #9C9C9C' : '2px solid #9C9C9C',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                marginBottom: cashSingleView ? '0.25rem' : '0.6rem',
              }}>
                <TbBtn tip="New — opens a blank form to enter a new voucher" label="New" icon="new" onClick={() => openCreate()} disabled={!canCreate} />
                <TbBtn tip={entryLockInfo?.locked ? 'View Only — this voucher is locked' : 'Edit — unlocks the current record for modification'} label={entryLockInfo?.locked ? 'View Only' : 'Edit'} icon={entryLockInfo?.locked ? 'view' : 'edit'} onClick={handleEditUnlock} disabled={isReadOnly || entryLockInfo?.locked || (!editingId && mode !== 'create')} />
                <TbBtn tip="Delete — removes the current voucher" label="Delete" icon="delete" onClick={handleDeleteVoucher} style={{ color: '#b00020' }} disabled={isReadOnly || entryLockInfo?.locked || (Boolean(editingId) && !canDeleteCurrentVoucher)} />
                <TbBtn tip="Save — saves your data permanently" label="Save" icon="save" onClick={saveVoucher} style={{ color: '#065f46' }} disabled={formReadOnly} />
                <Sep />
                <TbBtn tip="First — jumps to the very first voucher on record" label="First" icon="first" onClick={navFirst} disabled={curIdx <= 0} />
                <TbBtn tip="Previous — goes one record back" label="Previous" icon="previous" onClick={navPrev} disabled={curIdx <= 0} />
                <TbBtn tip="Next — goes one record forward" label="Next" icon="next" onClick={navNext} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <TbBtn tip="Last — jumps to the most recent voucher" label="Last" icon="last" onClick={navLast} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <Sep />
                <TbBtn tip="Print/Preview — prints or previews the current invoice" label="Print/Preview" icon="print" onClick={() => (onPrintPreview ? onPrintPreview() : window.print())} />
                <TbBtn tip="Search/Find — search by voucher number, party, or date" label="Search/Find" icon="search" onClick={handleSearchFind} />
                <div style={{ flex: 1 }} />
              </div>
            )
          })()}

          {error ? (
            <div role="alert" style={{ margin: '0 0.6rem 0.35rem', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: '0.8rem', fontWeight: 600 }}>
              {error}
            </div>
          ) : null}

          {entryLockInfo?.locked && (
            <div
              role="status"
              style={{
                margin: '0 0.9rem 0.6rem',
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#991B1B',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {entryLockInfo.ageLocked
                ? 'LOCKED — VIEW ONLY. This accounting entry is locked because more than 24 hours have passed since creation.'
                : 'LOCKED — VIEW ONLY. Accounting period is closed for this entry.'}
            </div>
          )}
          {!entryLockInfo?.locked && entryLockInfo?.editableUntil && entryLockInfo?.voucher24HourLockEnabled && (
            <div
              role="status"
              style={{
                margin: '0 0.9rem 0.6rem',
                padding: '0.45rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #BBF7D0',
                background: '#F0FDF4',
                color: '#166534',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Editable until {entryLockInfo.editableUntil.toLocaleString()}
            </div>
          )}

          {/* ── Body padding wrapper ── */}
          <div style={
            isProductTransferVoucher
              ? { padding: '0.55rem 0.7rem', background: '#FFFFFF' }
              : (isMetalVoucher ? metalWin.body : {
                padding: cashSingleView ? '0.35rem 0.6rem 0.5rem' : '0.75rem 0.9rem',
              })
          }
          >

          {/* ── Voucher section menu ── */}
          <div style={{
            display: 'flex',
            gap: isProductTransferVoucher ? '0.25rem' : '0.35rem',
            marginBottom: '0',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            padding: isProductTransferVoucher ? '0' : '0 0.15rem',
            borderBottom: '1px solid #BFC5CB',
          }}
          >
            <button
              style={(isProductTransferVoucher ? productTransferTabBtn : tabBtn)(menuTab === 'header')}
              onClick={() => setMenuTab('header')}
            >
              {isMetalVoucher ? 'Stock Details' : 'Header Details'}
            </button>
            <button
              style={(isProductTransferVoucher ? productTransferTabBtn : tabBtn)(menuTab === 'attachments')}
              onClick={() => setMenuTab('attachments')}
            >
              {t('attachments')}
            </button>
          </div>

          {/* ── Header Details ── */}
          {menuTab === 'header' && (
            <div style={isProductTransferVoucher ? productTransferSectionBox : { ...sectionBox, marginBottom: (cashSingleView || compactHeader) ? '0.2rem' : sectionBox.marginBottom }}>
              <div style={isProductTransferVoucher ? productTransferSectionBody : { ...sectionBody, padding: (cashSingleView || compactHeader) ? '0.28rem 0.4rem' : sectionBody.padding }}>
                {isProductTransferVoucher ? (
                  <div style={productTransferDocHeader}>
                    <div style={productTransferDocField}>
                      <label style={productTransferDocLabel}>Doc No :</label>
                      <input
                        aria-label="Doc No"
                        tabIndex={-1}
                        style={{ ...productTransferDocInput, background: '#F8FAFB', color: '#4B5563' }}
                        value={header.vocNo}
                        readOnly
                      />
                    </div>
                    <div style={productTransferDocField}>
                      <label style={productTransferDocLabel}>Doc Date :</label>
                      <input
                        ref={docDateRef}
                        aria-label="Date"
                        style={formReadOnly
                          ? { ...productTransferDocDateInput, background: '#F8FAFB', color: '#4B5563' }
                          : productTransferDocDateInput}
                        type="date"
                        value={header.docDate}
                        onChange={e => setHdr('docDate', e.target.value)}
                        onKeyDown={handleHeaderNavKeyDown}
                        readOnly={formReadOnly}
                      />
                    </div>
                  </div>
                ) : (
                <>
                <div style={classicHeaderShell}>
                  <div style={{ ...classicHeaderGrid, alignItems: 'flex-start', flexWrap: compactHeader ? 'nowrap' : classicHeaderGrid.flexWrap, gap: compactHeader ? '0.85rem' : classicHeaderGrid.gap }}>
                    <div style={compactHeader ? {
                      flex: '1 1 280px',
                      minWidth: 220,
                      alignSelf: 'stretch',
                      position: 'relative',
                      zIndex: 30,
                      border: '1px solid #8AA4C8',
                      borderRadius: '2px',
                      background: '#F4F7FB',
                      overflow: 'visible',
                    } : { ...classicPanel, flex: '0 1 640px', minWidth: '280px', alignSelf: 'flex-start', height: 'auto', position: 'relative', zIndex: 30 }}>
                      {compactHeader ? (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.22rem 0.55rem', background: '#E7EEF8', borderBottom: '1px solid #C5D4EA' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E3A5F', whiteSpace: 'nowrap' }}>Party Details</span>
                        </div>
                      ) : (
                        <div style={classicPanelTitle}>Party Details</div>
                      )}
                      <div style={compactHeader ? { padding: '0.4rem 0.5rem 0.45rem' } : classicPartyGrid}>
                        {(
                          <div style={{ display: 'flex', flexDirection: 'column', gap: compactHeader ? 0 : '0.3rem' }}>
                            {!compactHeader && <label style={classicLabel}>Party Account</label>}
                            <AccountCombobox
                              ref={partyAccountRef}
                              groups={isMetalVoucher ? metalPartyComboGroups : partyComboGroups}
                              value={selectedPartyId}
                              onChange={(val) => handlePartySelect(val)}
                              onKeyDown={handleHeaderNavKeyDown}
                              placeholder="Type account name or code…"
                              maxHeight={168}
                              style={formReadOnly ? classicReadInput : { ...classicInput, ...(compactHeader ? { minHeight: '1.55rem', borderRadius: '2px', background: '#FFFFFF' } : {}) }}
                              disabled={formReadOnly}
                            />
                          </div>
                        )}
                        {!compactHeader && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={classicLabel}>Party Code</label>
                          <div style={classicPartyCodeRow}>
                            <input
                              ref={partyCodeRef}
                              style={{ ...(formReadOnly ? classicReadInput : classicInput), flex: 1, minWidth: 0 }}
                              value={header.partyCode ?? ''}
                              onChange={e => setHdr('partyCode', e.target.value)}
                              onKeyDown={(e) => {
                                handlePartyCodeEnter(e)
                                handleHeaderNavKeyDown(e)
                              }}
                              placeholder={voucherConfig.partyPlaceholder}
                              readOnly={formReadOnly}
                            />
                            <button
                              type="button"
                              style={classicPartySearchBtn}
                              onClick={searchPartyByCode}
                              disabled={formReadOnly}
                              title="Search party by code"
                              aria-label="Search party by code"
                            >
                              <VoucherToolbarIcon name="search" size={14} />
                            </button>
                          </div>
                        </div>
                        )}
                      </div>
                      {(() => {
                        const resolvedParty = resolveVoucherParty(header.partyCode)
                        const partyName = resolvedParty?.partyName || header.partyName
                        if (!partyName) return null
                        const partyTypeLabel = resolvedParty?.partyType === 'vendor'
                          ? 'Vendor'
                          : resolvedParty?.partyType === 'customer' ? 'Customer' : ''
                        const phone = String(resolvedParty?.phone || '').trim()
                        const address = String(resolvedParty?.address || '').trim()
                        const contactParts = [phone, resolvedParty?.email, address]
                          .map((value) => String(value || '').trim())
                          .filter(Boolean)
                        const contact = contactParts.join(' · ')
                        return (
                          <div style={compactHeader ? { padding: '0.08rem 0.55rem 0.28rem', display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 } : classicPartySummary} title={[partyName, partyTypeLabel, contact].filter(Boolean).join(' · ')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                              <strong style={{ color: '#111827', fontSize: compactHeader ? '0.82rem' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partyName}</strong>
                              {partyTypeLabel ? <span style={classicPartyTypeTag}>{partyTypeLabel}</span> : null}
                            </div>
                            {compactHeader ? (
                              <>
                                {phone ? <span style={{ fontSize: '0.7rem', color: '#4B5563' }}>{phone}</span> : null}
                                {address ? <span style={{ fontSize: '0.7rem', color: '#4B5563', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{address}</span> : null}
                              </>
                            ) : contact ? <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem', color: '#4B5563' }}>{contact}</span> : null}
                          </div>
                        )
                      })()}
                    </div>

                    {compactHeader ? (
                      <div style={{ flex: isSimpleMetalVoucher ? '0 0 292px' : '0 0 420px', width: isSimpleMetalVoucher ? 292 : 420, display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '72px minmax(0, 1fr)' : '76px minmax(0, 1fr) 64px 112px', columnGap: '0.35rem', rowGap: '0.28rem', alignItems: 'center', alignSelf: 'flex-start' }}>
                        {isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher ? (
                          <>
                            <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Fixing :</span>
                            <select
                              ref={fixingTypeRef}
                              aria-label="Fixing Type"
                              style={{ ...(formReadOnly ? classicReadInput : classicInput), gridColumn: '2 / -1', width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.2rem', borderRadius: '2px', boxSizing: 'border-box' }}
                              value={header.fixingType}
                              onChange={e => setHdr('fixingType', e.target.value)}
                              onKeyDown={(e) => {
                                if (!formReadOnly && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                                  e.preventDefault()
                                  const next = e.currentTarget.value === 'non-fixing' ? 'fixing' : 'non-fixing'
                                  e.currentTarget.value = next
                                  setHdr('fixingType', next)
                                  return
                                }
                                handleHeaderNavKeyDown(e)
                              }}
                              disabled={formReadOnly}
                            >
                              <option value="fixing">Fixed</option>
                              <option value="non-fixing">UnFixed</option>
                            </select>
                          </>
                        ) : null}
                        {!(isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher) ? (
                          <>
                            <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Doc No :</span>
                            <input aria-label="Doc No" tabIndex={-1} style={{ ...classicReadInput, width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.35rem', borderRadius: '2px', boxSizing: 'border-box' }} value={header.vocNo} readOnly />
                          </>
                        ) : null}
                        {!isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher ? (
                          <input aria-label="Type" title="Voucher type" tabIndex={-1} style={{ ...classicReadInput, gridColumn: '4', width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.25rem', borderRadius: '2px', textAlign: 'center', boxSizing: 'border-box' }} value={voucherCode} readOnly />
                        ) : null}
                        <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Doc Date :</span>
                        <input ref={docDateRef} aria-label="Date" style={{ ...(formReadOnly ? classicReadInput : classicInput), minHeight: '1.5rem', width: '100%', minWidth: 0, padding: '0.08rem 0.2rem', borderRadius: '2px', fontSize: '0.75rem', boxSizing: 'border-box' }} type="date" value={header.docDate} onChange={e => setHdr('docDate', e.target.value)} onKeyDown={handleHeaderNavKeyDown} readOnly={formReadOnly} />
                        {!isSimpleMetalVoucher && (
                          <>
                            <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Val Date :</span>
                            <input ref={valueDateRef} aria-label="Value" style={{ ...(formReadOnly ? classicReadInput : classicInput), minHeight: '1.5rem', width: '100%', minWidth: 0, padding: '0.08rem 0.2rem', borderRadius: '2px', fontSize: '0.75rem', boxSizing: 'border-box' }} type="date" value={header.valueDate} onChange={e => setHdr('valueDate', e.target.value)} onKeyDown={handleHeaderNavKeyDown} readOnly={formReadOnly} />
                            <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Currency :</span>
                            <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr)', gap: '0.28rem', minWidth: 0 }}>
                              <select ref={headerCurrRef} aria-label="Curr" style={{ ...(formReadOnly ? classicReadInput : classicInput), width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.15rem', borderRadius: '2px', boxSizing: 'border-box' }} value={header.currCode} onChange={e => handleHeaderCurrencyChange(e.target.value)} onKeyDown={handleHeaderNavKeyDown} disabled={formReadOnly}>
                                {currencyOptions.length === 0 ? <option value="USD">USD</option> : currencyOptions.map((item) => (
                                  <option key={item.code} value={item.code}>{item.code}</option>
                                ))}
                              </select>
                              <input ref={headerRateRef} aria-label="Rate" style={{ ...(formReadOnly ? classicReadInput : classicInput), width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.28rem', borderRadius: '2px', boxSizing: 'border-box' }} value={header.currRate} onChange={e => handleHeaderCurrRateChange(e.target.value)} onKeyDown={handleHeaderNavKeyDown} type="number" step="0.000001" readOnly={formReadOnly} />
                            </div>
                            {isMetalStockVoucherType(voucherType) ? (
                              <>
                                <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Price :</span>
                                <input ref={headerPriceRef} aria-label="Price" style={{ ...(formReadOnly ? classicReadInput : classicInput), width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.28rem', borderRadius: '2px', textAlign: 'right', boxSizing: 'border-box' }} value={header.metalRate || ''} onChange={e => setHdr('metalRate', e.target.value)} onKeyDown={handleHeaderNavKeyDown} type="number" step="0.01" readOnly={formReadOnly} />
                              </>
                            ) : <span style={{ gridColumn: '3 / span 2' }} />}
                          </>
                        )}
                        {isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher ? (
                          <>
                            <span style={{ fontSize: '0.74rem', color: '#1F2937', textAlign: 'right' }}>Doc No :</span>
                            <input
                              aria-label="Doc No"
                              tabIndex={-1}
                              style={{ ...classicReadInput, gridColumn: '2 / -1', width: '100%', minWidth: 0, minHeight: '1.5rem', padding: '0.08rem 0.35rem', borderRadius: '2px', boxSizing: 'border-box' }}
                              value={header.vocNo}
                              readOnly
                              onFocus={() => docDateRef.current?.focus()}
                            />
                          </>
                        ) : null}
                      </div>
                    ) : (
                    <div style={{ ...classicPanel, flex: '0 1 430px', minWidth: '280px', alignSelf: 'flex-start', height: 'auto' }}>
                      <div style={classicRightGrid}>
                        <label style={classicLabel}>Doc No :</label>
                        <input
                          style={classicReadInput}
                          value={header.vocNo}
                          readOnly
                        />

                        {isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher ? (
                          <>
                            <label style={classicLabel}>Fixing Type :</label>
                            <select
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.fixingType}
                              onChange={e => setHdr('fixingType', e.target.value)}
                              disabled={formReadOnly}
                            >
                              <option value="fixing">Fixed</option>
                              <option value="non-fixing">UnFixed</option>
                            </select>
                          </>
                        ) : !isMetalStockVoucherType(voucherType) ? (
                          <>
                            <label style={classicLabel}>Voc Type :</label>
                            <input style={classicReadInput} value={voucherCode} readOnly />
                          </>
                        ) : null}

                        <label style={classicLabel}>Doc Date :</label>
                        <input
                          ref={docDateRef}
                          style={formReadOnly ? classicReadInput : classicInput}
                          type="date"
                          value={header.docDate}
                          onChange={e => setHdr('docDate', e.target.value)}
                          onKeyDown={handleHeaderNavKeyDown}
                          readOnly={formReadOnly}
                        />

                        {!isSimpleMetalVoucher && (
                          <>
                            <label style={classicLabel}>Value Date :</label>
                            <input
                              ref={valueDateRef}
                              style={formReadOnly ? classicReadInput : classicInput}
                              type="date"
                              value={header.valueDate}
                              onChange={e => setHdr('valueDate', e.target.value)}
                              onKeyDown={handleHeaderNavKeyDown}
                              readOnly={formReadOnly}
                            />

                            <label style={classicLabel}>Curr. Code :</label>
                            <select
                              ref={headerCurrRef}
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.currCode}
                              onChange={e => handleHeaderCurrencyChange(e.target.value)}
                              onKeyDown={handleHeaderNavKeyDown}
                              disabled={formReadOnly}
                            >
                              {currencyOptions.length === 0 ? (
                                <option value="USD">USD</option>
                              ) : currencyOptions.map((item) => (
                                <option key={item.code} value={item.code}>
                                  {item.code}{item.name ? ` - ${item.name}` : ''}{item.isActive ? '' : ' (Inactive)'}
                                </option>
                              ))}
                            </select>

                            <label style={classicLabel}>Curr. Rate :</label>
                            <input
                              ref={headerRateRef}
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.currRate}
                              onChange={e => handleHeaderCurrRateChange(e.target.value)}
                              onKeyDown={handleHeaderNavKeyDown}
                              type="number"
                              step="0.000001"
                              title="AED auto-default: 3.674 (you can edit manually)"
                              readOnly={formReadOnly}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
                </>
                )}
              </div>
            </div>
          )}

          {/* ── Account Details tab ── */}
          {showAccountDetailsTab && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                <div style={{ marginBottom: '0.85rem', border: `1px solid ${S.border}`, borderRadius: '0.45rem', padding: '0.6rem 0.7rem', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: S.ink }}>
                      Recent {voucherLabel} (Last 5)
                    </p>
                    {loadingRecentPartyVouchers && <span style={{ fontSize: '0.75rem', color: S.muted }}>Loading...</span>}
                  </div>
                  {!recentPartyVouchers.length ? (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: S.muted }}>
                      No recent vouchers found for this account.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: S.headerBg }}>
                            {['Doc No', 'Date', 'Type', 'Amount', 'Status'].map((headerCell) => (
                              <th key={headerCell} style={{ padding: '0.38rem 0.5rem', textAlign: headerCell === 'Amount' ? 'right' : 'left', borderBottom: `1px solid ${S.border}`, color: S.ink }}>{headerCell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentPartyVouchers.map((item, idx) => (
                            <tr key={item.id} style={{ background: idx % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: S.green }}>{item.vocNo}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{item.date}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.type}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{fmt(item.amount, item.currency)}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {lineItems.length === 0 ? (
                  <p style={{ color: S.muted, fontSize: '0.875rem' }}>No line items added yet. Switch to Line Items tab to add entries.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: S.headerBg }}>
                        {(isMetalVoucher
                          ? (isSimpleMetalVoucher
                            ? ['Stock Code', 'Product Type', 'PCS', 'Gross Wt.', 'Purity', 'Pure Wt.', 'Narration']
                            : ['Stock Code', 'PCS', 'Gross Wt.', 'Purity', 'Pure Wt.', 'Rate Type', 'Metal Rate', 'Metal Amount', 'Total', 'Narration'])
                          : ['A/C Code', 'Type', 'Currency', 'Amount FC', 'Amount LC', 'Narration']
                        ).map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((l, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.bg }}>
                          {isMetalVoucher ? (
                            <>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{l.stockCode || '-'}</td>
                              {isSimpleMetalVoucher && (
                                <td style={{ padding: '0.5rem 0.75rem' }}>{l.productType || '-'}</td>
                              )}
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.pcs || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.grossWeight || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.purity || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.pureWeight || '-'}</td>
                              {!isSimpleMetalVoucher && (
                                <>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{l.rateType || '-'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(parseFloat(l.metalRate) || ((parseFloat(l.weightInOz) || 0) > 0 ? ((parseFloat(l.metalAmount) || 0) / (parseFloat(l.weightInOz) || 0)) : 0))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.metalAmount, header.currCode || baseCurrencyCode)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(l.totalAmount || l.amountLC, header.currCode || baseCurrencyCode)}</td>
                                </>
                              )}
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration || l.remarks || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.acCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.type}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.currCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountFC, l.currCode || header.currCode || baseCurrencyCode)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountLC, baseCurrencyCode)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Line Items panel ── */}
          {(menuTab === 'header' || menuTab === 'lineItems') && (
            <div style={isProductTransferVoucher ? productTransferSectionBox : { ...sectionBox, marginBottom: (cashSingleView || compactHeader) ? '0.15rem' : sectionBox.marginBottom, ...(cashSingleView ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}) }}>
              <div style={{
                ...(isMetalVoucher ? { ...classicPanelTitle, ...metalWin.tabLabel } : classicPanelTitle),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...(isProductTransferVoucher ? { padding: '6px 10px', fontSize: '0.7rem', borderRadius: 0 } : {}),
              }}
              >
                <span>{isProductTransferVoucher ? 'From / To Transfer' : (isMetalVoucher ? 'Stock Details' : 'LINE ITEMS')}</span>
              </div>

              {isProductTransferVoucher ? (
                <MetalTransferEditor
                  lineItems={lineItems}
                  setLineItems={setLineItems}
                  inventoryProducts={inventoryProducts}
                  formReadOnly={formReadOnly}
                  loadingInventoryProducts={loadingInventoryProducts}
                  onFieldKeyDown={handleHeaderNavKeyDown}
                  fromProductRef={transferFromProductRef}
                  fromPcsRef={transferFromPcsRef}
                  fromGrossRef={transferFromGrossRef}
                  toProductRef={transferToProductRef}
                  toPcsRef={transferToPcsRef}
                />
              ) : (
              <>
              {/* Line items table */}
              <div style={{ overflowX: 'auto', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #C9CED6', background: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={isMetalVoucher ? metalWin.headerRow : { background: 'var(--brand-soft)' }}>
                      {lineTableHeaders.map(h => (
                        <th key={h} style={{ padding: compactHeader ? '0.14rem 0.4rem' : '0.34rem 0.48rem', textAlign: ['Amount FC', 'Amount LC', 'Metal Rate', 'Metal Amount', 'Total', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.'].includes(h) ? 'right' : 'left', fontWeight: '700', color: isMetalVoucher ? '#374151' : '#374151', borderBottom: isMetalVoucher ? '1px solid #C9CED6' : '1px solid #C9CED6', borderRight: isMetalVoucher ? '1px solid #E5E7EB' : '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={lineTableHeaders.length} style={{ padding: cashSingleView ? '0.35rem 0.5rem' : '1rem', textAlign: 'center', color: S.muted, borderBottom: '1px solid #D7DBE0' }}>
                          {formReadOnly ? 'No line items.' : 'No line items yet.'}
                        </td>
                      </tr>
                    ) : lineItems.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FBFBFC', borderBottom: isMetalVoucher ? metalWin.tableCell.borderBottom : '1px solid #D7DBE0' }}>
                        <td style={{ padding: compactHeader ? '0.12rem 0.4rem' : '0.28rem 0.48rem', borderRight: isMetalVoucher ? metalWin.tableCell.borderRight : '1px solid #EEF1F4', background: isMetalVoucher ? metalWin.tableCell.background : undefined }}>{i + 1}</td>
                        {isMetalVoucher ? (
                          <>
                            <td style={{ padding: '0.12rem 0.4rem', fontWeight: '600', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.stockCode || '-'}</td>
                            {isSimpleMetalVoucher && (
                              <td style={{ padding: '0.12rem 0.4rem', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.productType || '-'}</td>
                            )}
                            <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pcs || '-'}</td>
                            <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.grossWeight || '-'}</td>
                            <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.purity || '-'}</td>
                            <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pureWeight || '-'}</td>
                            {!isSimpleMetalVoucher && (
                              <>
                                <td style={{ padding: '0.12rem 0.4rem', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.rateType || '-'}</td>
                                <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(parseFloat(l.metalRate) || ((parseFloat(l.weightInOz) || 0) > 0 ? ((parseFloat(l.metalAmount) || 0) / (parseFloat(l.weightInOz) || 0)) : 0))}</td>
                                <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.metalAmount, header.currCode || baseCurrencyCode)}</td>
                                <td style={{ padding: '0.12rem 0.4rem', textAlign: 'right', fontWeight: '700', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.totalAmount || l.amountLC, header.currCode || baseCurrencyCode)}</td>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '0.28rem 0.48rem', fontWeight: '600', borderRight: '1px solid #EEF1F4' }}>{l.acCode}</td>
                            <td style={{ padding: '0.28rem 0.48rem', borderRight: '1px solid #EEF1F4' }}>
                              <span style={{ padding: '0.08rem 0.28rem', borderRadius: '0.2rem', fontSize: '0.68rem', fontWeight: '700', background: normalizeLineType(l.type) === 'Cash' ? '#D1FAE5' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#DBEAFE' : '#FEF3C7', color: normalizeLineType(l.type) === 'Cash' ? '#065F46' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#1D4ED8' : '#92400E' }}>
                                {normalizeLineType(l.type) === 'TT' ? 'TT' : normalizeLineType(l.type)}
                              </span>
                            </td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountFC, l.currCode || header.currCode || baseCurrencyCode)}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountLC, baseCurrencyCode)}</td>
                          </>
                        )}
                        <td style={{ padding: '0.24rem 0.42rem' }}>
                          {!isReadOnly && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button style={{ ...btn('secondary'), padding: '0.14rem 0.42rem', fontSize: '0.68rem', borderRadius: '0.18rem' }} onClick={() => handleEditLineClick(i)}>Edit</button>
                              <button style={{ ...btn('danger'), padding: '0.14rem 0.42rem', fontSize: '0.68rem', borderRadius: '0.18rem' }} onClick={() => handleDeleteLineClick(i)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Line Detail Add/Edit Form ── */}
              {showLineForm && (
                <div style={{ borderTop: '2px solid #A0A8B0', background: '#FAFBFC', padding: 0 }}>
                  {!compactHeader && (
                    <div style={{ ...classicPanelTitle }}>
                      {editingLineIdx !== null ? 'Edit Line Item' : 'Add Line Item'}
                    </div>
                  )}
                  <div style={{ padding: cashSingleView ? '0.28rem 0.4rem' : '0.2rem 0.35rem' }}>

                  {isMetalVoucher ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '1fr' : 'minmax(0, 1.35fr) minmax(0, 0.85fr) minmax(0, 0.9fr) minmax(0, 1.15fr)', gap: '0.35rem', alignItems: 'stretch', marginBottom: '0.25rem' }}>
                        <div style={{ borderTop: `1px solid ${S.border}`, borderLeft: `1px solid ${S.border}`, borderRight: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, background: S.white, display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr) 104px minmax(0, 1fr)', gridAutoRows: 28, alignContent: 'start', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
                          {!isSimpleMetalVoucher && <div style={{ ...stockLabelCell, gridColumn: '1 / -1', fontWeight: '700', justifyContent: 'flex-start' }}>Stock</div>}
                          <div style={{ ...stockLabelCell, fontWeight: '700', color: S.ink }}>Stock *</div>
                          <select
                            ref={metalStockRef}
                            aria-label="Stock"
                            style={{ ...stockFieldCell, gridColumn: '2 / -1' }}
                            value={lineForm.stockCode}
                            onChange={(e) => handleStockSelection(e.target.value)}
                            onKeyDown={handleMetalLineNavKeyDown}
                          >
                            <option value="">{loadingInventoryProducts ? 'Loading stock...' : 'Select stock'}</option>
                            {inventoryStockOptions.map((option) => (
                              <option key={option.code} value={option.code}>{option.label}</option>
                            ))}
                          </select>
                          <div style={{ ...stockLabelCell, fontWeight: '700', color: S.ink }}>Product Type</div>
                          <select
                            ref={metalProductRef}
                            aria-label="Product Type"
                            style={{ ...stockFieldCell, gridColumn: '2 / -1' }}
                            value={lineForm.productType}
                            onKeyDown={handleMetalLineNavKeyDown}
                            onChange={(e) => {
                              const selectedName = e.target.value
                              if (!selectedName) {
                                setLineForm((prev) => ({ ...prev, productType: '' }))
                                return
                              }
                              setLineForm((prev) => applyProductTypeAutoFill({ ...prev, productType: selectedName }, selectedName))
                            }}
                          >
                            <option value="">Select product type</option>
                            {getInventoryCatalogProductsForStock(inventoryProducts, lineForm.stockCode)
                              .map(p => <option key={p._id} value={p.name}>{p.name}</option>)
                            }
                          </select>
                          <div style={stockLabelCell}>Gross Weight</div>
                          <input ref={metalGrossRef} aria-label="Gross Weight" style={{ ...stockFieldCell, textAlign: 'right', gridColumn: isSimpleMetalVoucher ? '2 / -1' : undefined }} type="number" step="0.001" value={lineForm.grossWeight} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, grossWeight: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                          {!isSimpleMetalVoucher && (
                            <>
                              <div style={stockLabelCell}>Purity</div>
                              <input ref={metalPurityRef} aria-label="Purity" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.001" value={lineForm.purity} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, purity: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                            </>
                          )}
                          {isSimpleMetalVoucher ? (
                            <>
                              <div style={stockLabelCell}>Purity</div>
                              <input ref={metalPurityRef} aria-label="Purity" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.001" value={lineForm.purity} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, purity: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                              <div style={stockLabelCell}>Pure Weight</div>
                              <input ref={metalPureRef} aria-label="Pure Weight" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.001" value={lineForm.pureWeight} onChange={e => { const pw = parseFloat(e.target.value) || 0; setLineForm(prev => applyLineAutoCalc({ ...prev, pureWeight: e.target.value, weightInOz: pw > 0 ? (pw / 31.1034768).toFixed(3) : '' })) }} onKeyDown={handleMetalLineNavKeyDown} />
                              <div style={stockLabelCell}>PCS</div>
                              <input ref={metalPcsRef} aria-label="PCS" style={{ ...stockFieldCell, textAlign: 'right', gridColumn: '2 / -1' }} type="number" step="1" value={lineForm.pcs} onChange={e => setLineForm(prev => applyProductTypeAutoFill({ ...prev, pcs: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                            </>
                          ) : (
                            <>
                              <div style={stockLabelCell}>Pure Weight</div>
                              <input ref={metalPureRef} aria-label="Pure Weight" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.001" value={lineForm.pureWeight} onChange={e => { const pw = parseFloat(e.target.value) || 0; setLineForm(prev => applyLineAutoCalc({ ...prev, pureWeight: e.target.value, weightInOz: pw > 0 ? (pw / 31.1034768).toFixed(3) : '' })) }} onKeyDown={handleMetalLineNavKeyDown} />
                              <div style={stockLabelCell}>Weight In OZ.</div>
                              <input ref={metalOzRef} aria-label="Weight In OZ" style={{ ...stockFieldCell, textAlign: 'right' }} value={lineForm.weightInOz || ((parseFloat(lineForm.pureWeight) || 0) > 0 ? ((parseFloat(lineForm.pureWeight) || 0) / 31.1034768).toFixed(3) : '')} onChange={e => setLF('weightInOz', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                              <div style={stockLabelCell}>PCS</div>
                              <input ref={metalPcsRef} aria-label="PCS" style={{ ...stockFieldCell, textAlign: 'right', gridColumn: '2 / -1' }} type="number" step="1" value={lineForm.pcs} onChange={e => setLineForm(prev => applyProductTypeAutoFill({ ...prev, pcs: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                            </>
                          )}
                        </div>

                        {!isSimpleMetalVoucher && (
                        <div style={{ display: 'contents' }}>
                          <div style={{ borderTop: `1px solid ${S.border}`, borderLeft: `1px solid ${S.border}`, borderRight: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, background: S.white, display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gridAutoRows: 28, alignContent: 'start', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
                            <div style={{ ...stockLabelCell, gridColumn: '1 / -1', fontWeight: '700' }}>Making / Margin</div>
                            <div style={stockLabelCell}>Rate Type</div>
                            <select ref={metalRateTypeRef} aria-label="Making Rate Type" style={stockFieldCell} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} onKeyDown={handleMetalLineNavKeyDown}>
                              <option value="OZ">OZ</option>
                              <option value="GRAM">GRAM</option>
                              <option value="KG">KG</option>
                            </select>
                            <div style={stockLabelCell}>Rate</div>
                            <input ref={metalMakingRateRef} aria-label="Making Rate" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLF('metalRate', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                            <div style={stockLabelCell}>Amount</div>
                            <input tabIndex={-1} aria-label="Making Amount" style={{ ...stockFieldCell, textAlign: 'right', background: '#F9FAFB' }} type="number" step="0.01" value={lineForm.metalAmount} readOnly />
                            <div style={stockLabelCell}>Purity Diff</div>
                            <input ref={metalPurityDiffRef} aria-label="Purity Diff" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.001" value={lineForm.purityDiff} onChange={e => setLF('purityDiff', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                          </div>

                          <div style={{ borderTop: `1px solid ${S.border}`, borderLeft: `1px solid ${S.border}`, borderRight: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, background: S.white, display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gridAutoRows: 28, alignContent: 'start', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
                            <div style={{ ...stockLabelCell, gridColumn: '1 / -1', fontWeight: '700' }}>Premium Values</div>
                            <div style={stockLabelCell}>Currency</div>
                            <select ref={metalPremCurrRef} aria-label="Premium Currency" style={stockFieldCell} value={lineForm.currCode} onChange={e => handleLineCurrencyChange(e.target.value)} onKeyDown={handleMetalLineNavKeyDown}>
                              {currencyOptions.length === 0 ? (
                                <option value="USD">USD</option>
                              ) : currencyOptions.map((item) => (
                                <option key={item.code} value={item.code}>{item.code}</option>
                              ))}
                            </select>
                            <div style={stockLabelCell}>Rate</div>
                            <input aria-label="Voucher Rate" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.000001" value={header.currRate} onChange={e => handleHeaderCurrRateChange(e.target.value)} onKeyDown={handleMetalLineNavKeyDown} readOnly={formReadOnly || String(header.currCode || baseCurrencyCode).trim().toUpperCase() === String(baseCurrencyCode || 'USD').trim().toUpperCase()} />
                            <div style={stockLabelCell}>Premium</div>
                            <input ref={metalPremiumRef} aria-label="Premium" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.000001" value={lineForm.premiumValue} onChange={e => setLF('premiumValue', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                            <div style={stockLabelCell}>Total (FC)</div>
                            <input tabIndex={-1} aria-label="Total FC" style={{ ...stockFieldCell, textAlign: 'right', background: '#F9FAFB' }} readOnly value={String(header.currCode || '').trim().toUpperCase() !== String(baseCurrencyCode || 'USD').trim().toUpperCase() ? (lineForm.amountFC || '') : (lineForm.metalAmount || '')} />
                            <div style={stockLabelCell}>Total (LC)</div>
                            <input tabIndex={-1} aria-label="Total LC" style={{ ...stockFieldCell, textAlign: 'right', background: '#F9FAFB' }} readOnly value={lineForm.totalAmount || lineForm.amountLC || ''} />
                          </div>

                          <div style={{ borderTop: `1px solid ${S.border}`, borderLeft: `1px solid ${S.border}`, borderRight: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, background: S.white, display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr) 78px minmax(0, 1fr)', gridAutoRows: 28, alignContent: 'start', minWidth: 0, height: '100%', boxSizing: 'border-box' }}>
                            <div style={{ ...stockLabelCell, gridColumn: '1 / -1', fontWeight: '700' }}>Metal Rate & Amount</div>
                            <div style={stockLabelCell}>Rate Type</div>
                            <input ref={metalRateTypeTextRef} aria-label="Metal Rate Type" style={stockFieldCell} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                            <div style={stockLabelCell}>Rate</div>
                            <input ref={metalLineRateRef} aria-label="Metal Rate" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, metalRate: e.target.value }))} onKeyDown={handleMetalLineNavKeyDown} />
                            <div style={stockLabelCell}>Metal Amt</div>
                            <input tabIndex={-1} aria-label="Metal Amount" style={{ ...stockFieldCell, textAlign: 'right', color: '#991B1B', fontWeight: '700', background: '#F9FAFB' }} readOnly value={lineForm.metalAmount} />
                            <div style={stockLabelCell}>Prem Amt</div>
                            <input tabIndex={-1} aria-label="Premium Amount" style={{ ...stockFieldCell, textAlign: 'right', background: '#F9FAFB' }} readOnly value={lineForm.premiumAmount || ''} />
                            <div style={stockLabelCell}>Making</div>
                            <input ref={metalMakingRef} aria-label="Making Charges" style={{ ...stockFieldCell, textAlign: 'right' }} type="number" step="0.01" value={lineForm.makingCharges} onChange={e => setLF('makingCharges', e.target.value)} onKeyDown={handleMetalLineNavKeyDown} />
                            <div style={{ ...stockLabelCell, fontWeight: '700' }}>Total</div>
                            <input tabIndex={-1} aria-label="Line Total" style={{ ...stockFieldCell, textAlign: 'right', fontWeight: '700', background: '#F9FAFB' }} readOnly value={lineForm.totalAmount} />
                            <div style={{ ...stockLabelCell, fontWeight: '700' }}>Tot+Tax</div>
                            <input tabIndex={-1} aria-label="Amount With Tax" style={{ ...stockFieldCell, textAlign: 'right', fontWeight: '700', gridColumn: '2 / -1' }} readOnly value={lineForm.amountWithVAT || ''} />
                          </div>
                        </div>
                        )}
                      </div>

                      {isMetalVoucher && (
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.12rem', alignItems: 'center' }}>
                          <button type="button" ref={metalSaveBtnRef} style={{ ...btn('primary'), minWidth: '92px', padding: '0.28rem 0.7rem' }} onClick={saveLine} onKeyDown={handleMetalLineNavKeyDown}>Add line item</button>
                          <button type="button" ref={metalClearBtnRef} style={{ ...btn('secondary'), minWidth: '72px', padding: '0.28rem 0.7rem' }} onClick={openAddLine} onKeyDown={handleMetalLineNavKeyDown}>Clear</button>
                          {!isSimpleMetalVoucher && (
                            <>
                              <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#374151' }}>Tax</span>
                              <select ref={metalTaxRef} aria-label="Tax Type" style={{ ...inputStyle, height: 26, width: 88, padding: '0 0.25rem' }} value={lineForm.vatType || 'VAT'} onChange={e => setLF('vatType', e.target.value)} onKeyDown={handleMetalLineNavKeyDown}>
                                <option value="VAT">VAT</option>
                                <option value="GST">GST</option>
                                <option value="Sales Tax">Sales Tax</option>
                                <option value="None">None</option>
                              </select>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ border: '1px solid #C9CED6', borderRadius: '0.15rem', overflow: 'visible', background: '#FFFFFF', fontSize: '0.78rem', width: '100%' }}>
                      {/* Type and account stay short. Amounts sit on the right so the row fills the voucher. */}
                      <div style={{ display: 'grid', gridTemplateColumns: '52px 88px 52px minmax(180px, 240px) 1fr 148px 148px', borderBottom: '1px solid #E5E7EB', alignItems: 'center', minHeight: 0 }}>
                        <div style={{ height: 26, padding: '0 0.35rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.68rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Type</div>
                        <select ref={lineTypeRef} aria-label="Line Type" style={{ height: 26, border: 0, borderRadius: 0, padding: '0 0.2rem', fontSize: '0.75rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB', width: '100%' }} value={lineForm.type} onChange={e => handleLineTypeChange(e.target.value)} onKeyDown={handleCashLineNavKeyDown}>
                          <option value="Cash">Cash</option>
                          <option value="TT">TT</option>
                          <option value="Card">Card</option>
                        </select>
                        <div style={{ height: 26, padding: '0 0.3rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.68rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>A/C *</div>
                        <AccountCombobox
                          ref={lineAcCodeRef}
                          groups={lineAccountComboGroups}
                          value={lineForm.acCode || ''}
                          onChange={(val) => handleLineAcCodeChange(val)}
                          onKeyDown={handleCashLineNavKeyDown}
                          placeholder="Account"
                          style={{ height: 26, border: 0, borderRadius: 0, padding: '0 0.35rem', fontSize: '0.75rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }}
                          disabled={formReadOnly}
                        />
                        <div />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: 26, padding: '0 0.35rem', borderLeft: '1px solid #E5E7EB' }}>
                          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#4B5563', whiteSpace: 'nowrap' }}>FC</span>
                          <input ref={lineAmtFcRef} aria-label="Amount FC" placeholder="0.00" style={{ border: '1px solid #9CA3AF', borderRadius: 3, padding: '0 0.3rem', fontSize: '0.75rem', background: '#FFFFFF', outline: 'none', textAlign: 'right', width: '100%', boxSizing: 'border-box', height: 22 }} type="text" inputMode="decimal" value={lineForm.amountFC} onChange={e => handleAmountFC(e.target.value)} onKeyDown={handleCashLineNavKeyDown} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: 26, padding: '0 0.35rem 0 0' }}>
                          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#4B5563', whiteSpace: 'nowrap' }}>LC *</span>
                          <input ref={lineAmtLcRef} aria-label="Amount LC" placeholder="0.00" style={{ border: '1px solid #9CA3AF', borderRadius: 3, padding: '0 0.3rem', fontSize: '0.75rem', background: '#FFFFFF', outline: 'none', textAlign: 'right', width: '100%', boxSizing: 'border-box', height: 22 }} type="text" inputMode="decimal" value={lineForm.amountLC} onChange={e => handleAmountLC(e.target.value)} onKeyDown={handleCashLineNavKeyDown} />
                        </label>
                      </div>
                      {/* Ref Rate row - shows for payment/receipt with non-base foreign currency */}
                      {showRefRate && (
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', borderBottom: '1px solid #E5E7EB', background: '#FFFBEB' }}>
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontWeight: '700', fontSize: '0.7rem', color: '#92400E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Ref Rate</div>
                          <input ref={lineRefRateRef} style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFFBEB', outline: 'none', textAlign: 'right', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.referenceRate || ''} onChange={e => setLF('referenceRate', e.target.value)} onKeyDown={handleCashLineNavKeyDown} placeholder="Original invoice rate" />
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontSize: '0.68rem', color: '#92400E', borderRight: '1px solid #DDE1E8', display: 'flex', alignItems: 'center' }}></div>
                          <div style={{ padding: '0.26rem 0.45rem', fontSize: '0.68rem', color: '#92400E', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>Rate when obligation was created (for FX gain/loss)</div>
                        </div>
                      )}
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.32rem 0.55rem', background: '#F8FAFC', borderTop: '1px solid #D4D8DE' }}>
                        {cashSingleView ? (
                          <>
                            <button type="button" ref={addLineBtnRef} style={{ padding: '0.28rem 0.75rem', fontSize: '0.78rem', fontWeight: '700', background: 'var(--grad-brand)', border: '1px solid var(--purple)', borderRadius: '0.15rem', cursor: 'pointer', color: 'var(--brand-on-primary)' }} onClick={saveLine} onKeyDown={handleCashLineNavKeyDown}>Add line item</button>
                            <button type="button" ref={lineSaveBtnRef} style={{ padding: '0.28rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: '#FFFFFF', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer' }} onClick={openAddLine} onKeyDown={handleCashLineNavKeyDown}>Clear</button>
                          </>
                        ) : (
                          <>
                            <button type="button" style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: '#FFFFFF', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'none' }} onClick={() => { saveLine(); if (!String(lineForm.acCode || '').trim()) return; setTimeout(() => openAddLine(), 50) }}>Continue</button>
                            <button type="button" ref={lineSaveBtnRef} style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'var(--grad-brand)', border: '1px solid var(--purple)', borderRadius: '0.15rem', cursor: 'pointer', color: 'var(--brand-on-primary)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} onClick={saveLine} onKeyDown={handleCashLineNavKeyDown}>Save</button>
                            <button type="button" style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: '#FFFFFF', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'none' }} onClick={cancelLine}>Cancel</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}

              {/* ── Bottom strip: Actions + Remarks + Amount Summary ── */}
              <div style={{ borderTop: '2px solid #B8BEC8', background: '#F8FAFC', padding: compactHeader ? '0.18rem 0.45rem' : '0.38rem 0.55rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '0.4rem', alignItems: 'stretch' }}>
                  {/* Left: Add/Edit/Delete + Remarks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.16rem', minWidth: 0, minHeight: 0 }}>
                    {!isReadOnly && !cashSingleView && !showLineForm && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          ref={addLineBtnRef}
                          style={{ padding: '0.2rem 0.72rem', fontSize: '0.74rem', fontWeight: '700', background: '#FFFFFF', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'none' }}
                          onClick={handleAddLineClick}
                          onKeyDown={handleHeaderNavKeyDown}
                        >Add</button>
                      </div>
                    )}
                    {compactHeader && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08rem', minWidth: 0, flex: 1, minHeight: 0 }}>
                        <label htmlFor="voucher-shared-narration" style={{ ...classicLabel, lineHeight: 1.1 }}>Narration</label>
                        <textarea
                          id="voucher-shared-narration"
                          ref={lineNarrationRef}
                          rows={2}
                          style={{ ...classicInput, width: '100%', minHeight: '3.2rem', height: '100%', resize: 'none', borderRadius: '2px', padding: '0.28rem 0.4rem', fontSize: '0.78rem', lineHeight: 1.35 }}
                          value={header.narration || ''}
                          onChange={(e) => setHdr('narration', e.target.value)}
                          onKeyDown={isMetalVoucher ? handleMetalLineNavKeyDown : handleCashLineNavKeyDown}
                          placeholder="One narration for all line items"
                          readOnly={formReadOnly}
                        />
                      </div>
                    )}
                  </div>
                  {/* Right: Amount Summary / Total Summary */}
                  <div style={{ border: '1px solid #8EA0C5', borderRadius: '0.15rem', background: '#FFFFFF', width: '100%', overflow: 'hidden' }}>
                    <div style={{ ...(isMetalVoucher ? metalWin.summaryHeader : { background: 'var(--brand-soft)', color: '#374151' }), borderBottom: isMetalVoucher ? `1px solid ${S.greenDark}` : '1px solid #8EA0C5', padding: '0.12rem 0.55rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{isSimpleMetalVoucher ? 'Total Summary' : 'Amount Summary'}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                      <tbody>
                        {isSimpleMetalVoucher && (
                          <>
                            <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                              <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Gross Weight :</td>
                              <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{totals.grossWeightTotal > 0 ? totals.grossWeightTotal.toFixed(3) : '0.000'}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                              <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Pure Weight :</td>
                              <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{totals.pureWeightTotal > 0 ? totals.pureWeightTotal.toFixed(3) : '0.000'}</td>
                            </tr>
                            <tr style={{ background: '#F1F3F6' }}>
                              <td style={{ padding: '0.1rem 0.55rem', color: '#111827', fontWeight: '700' }}>Total PCS :</td>
                              <td style={{ padding: '0.1rem 0.55rem', textAlign: 'right', fontWeight: '800', color: S.green, fontSize: '0.87rem' }}>{totals.pcsTotal > 0 ? Math.round(totals.pcsTotal).toLocaleString('en-US') : '0'}</td>
                            </tr>
                          </>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Metal Amount :</td>
                            <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.metalTotal, header.currCode || baseCurrencyCode)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && totals.premiumTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Premium Amount :</td>
                            <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.premiumTotal, header.currCode || baseCurrencyCode)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && totals.makingTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Making Charges :</td>
                            <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.makingTotal, header.currCode || baseCurrencyCode)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>Gross Amount :</td>
                            <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.total, header.currCode || baseCurrencyCode)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.08rem 0.55rem', color: '#374151' }}>VAT Amount :</td>
                            <td style={{ padding: '0.08rem 0.55rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.vatAmount, header.currCode || baseCurrencyCode)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && buildNetAmountRows({
                          voucherCurrency: receiptPaymentNetAmtLabelCurrency || header.currCode || baseCurrencyCode || 'USD',
                          voucherTotal: totals.grandTotal,
                          voucherNetAmounts,
                        }).map((row) => (
                          <tr key={row.code} style={{ background: '#F1F3F6', borderTop: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.1rem 0.55rem', color: '#111827', fontWeight: '700' }}>
                              {`Net Amt (${row.code}) :`}
                            </td>
                            <td style={{ padding: '0.1rem 0.55rem', textAlign: 'right', fontWeight: '800', color: S.green, fontSize: '0.87rem' }}>{fmt(row.amount, row.code)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>
          )}

          {/* ── Attachments panel ── */}
          {menuTab === 'attachments' && (
            <VoucherAttachmentsPanel
              editingId={editingId}
              attachments={currentAttachments}
              isReadOnly={isReadOnly}
              saving={saving}
              attachmentInputKey={attachmentInputKey}
              onUpload={handleUploadVoucherAttachments}
              onPreview={handlePreviewVoucherAttachment}
              onDelete={handleDeleteVoucherAttachment}
              styles={{
                sectionBox: isProductTransferVoucher ? productTransferSectionBox : sectionBox,
                sectionHeader,
                sectionBody: isProductTransferVoucher ? productTransferSectionBody : sectionBody,
                btn: isProductTransferVoucher ? productTransferActionBtn : btn,
                S,
              }}
            />
          )}

          {/* ── Voucher Workflow ── */}
          {editingId && (
            <div style={{ ...classicPanel, marginBottom: '0.75rem' }}>
              <div style={{ ...classicPanelTitle }}>{t('approvalWorkflow')}</div>
              <div style={{ padding: '0.5rem 0.65rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.6fr)', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <label style={labelStyle}>Workflow Note</label>
                    <textarea
                      value={workflowNote}
                      onChange={(e) => setWorkflowNote(e.target.value)}
                      rows={3}
                      placeholder="Optional note for submit"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '76px' }}
                      readOnly={isReadOnly || saving}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', background: currentVoucherStatus === 'draft' ? '#FEF3C7' : currentVoucherStatus === 'submitted' ? '#DBEAFE' : currentVoucherStatus === 'approved' ? '#DCFCE7' : currentVoucherStatus === 'posted' ? '#D1FAE5' : currentVoucherStatus === 'returned' ? '#FCE7F3' : '#FEE2E2', color: currentVoucherStatus === 'draft' ? '#92400E' : currentVoucherStatus === 'submitted' ? '#1D4ED8' : currentVoucherStatus === 'approved' ? '#166534' : currentVoucherStatus === 'posted' ? '#065F46' : currentVoucherStatus === 'returned' ? '#9D174D' : '#B91C1C' }}>
                      Current: {currentVoucherStatus}
                    </span>
                    {canSubmitWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('submit')} style={{ ...btn('gray'), background: '#F59E0B', color: '#111827' }}>
                        {t('submit')}
                      </button>
                    )}
                    {canReturnWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('return')} style={{ ...btn('gray'), background: '#F472B6', color: '#831843' }}>
                        {t('returnForEdit')}
                      </button>
                    )}
                    {canRejectWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('reject')} style={{ ...btn('gray'), background: '#FEE2E2', color: '#B91C1C' }}>
                        {t('reject')}
                      </button>
                    )}
                    {canRevalueCurrentVoucher && (
                      <button type="button" disabled={saving} onClick={() => handleRevalueFxJournal(currentVoucher)} style={{ ...btn('gray'), background: '#E0F2FE', color: '#0C4A6E' }}>
                        Revalue FX Journal
                      </button>
                    )}
                    {!canSubmitWorkflow && !canReturnWorkflow && !canRejectWorkflow && (
                      <span style={{ color: S.muted, fontSize: '0.82rem' }}>No workflow action available for your role or current status.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isReadOnly && (
            <div style={isProductTransferVoucher
              ? productTransferFooter
              : { display: 'flex', gap: '0.55rem', marginTop: (cashSingleView || compactHeader) ? '0.15rem' : '1rem', padding: (cashSingleView || compactHeader) ? '0.28rem 0.55rem 0.4rem' : '1rem 0 0', borderTop: `1px solid ${S.border}` }}
            >
              <button
                type="button"
                ref={saveVoucherBtnRef}
                style={{
                  ...(isProductTransferVoucher ? productTransferActionBtn('primary') : btn('primary')),
                  opacity: saving ? 0.7 : 1,
                }}
                onClick={saveVoucher}
                onKeyDown={handleHeaderNavKeyDown}
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingId ? '💾 Update Voucher' : '💾 Save Voucher')}
              </button>
              <button
                type="button"
                ref={cancelVoucherBtnRef}
                style={isProductTransferVoucher ? productTransferActionBtn('secondary') : btn('secondary')}
                onClick={() => setMode('list')}
                onKeyDown={handleHeaderNavKeyDown}
              >
                {t('cancel')}
              </button>
            </div>
          )}
          {isReadOnly && (
            <div style={isProductTransferVoucher
              ? { ...productTransferFooter, borderTop: 'none', paddingTop: 0 }
              : { marginTop: '0.75rem' }}
            >
              <button
                style={isProductTransferVoucher ? productTransferActionBtn('secondary') : btn('secondary')}
                onClick={() => setMode('list')}
              >
                ← Back
              </button>
            </div>
          )}
          </div>
          </div>
        </div>
      )}
    </>
  )
}
