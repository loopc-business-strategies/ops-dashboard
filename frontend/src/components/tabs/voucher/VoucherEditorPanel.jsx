import AccountCombobox from '../../AccountCombobox'
import VoucherAttachmentsPanel from '../erp/VoucherAttachmentsPanel'
import {
  S, btn, fmt, inputStyle, labelStyle, tabBtn, sectionBox, sectionHeader, sectionBody,
  classicHeaderShell, classicHeaderGrid, classicPanel, classicPanelTitle, classicPartyGrid,
  classicPartyCard, classicPartyCardHeader, classicPartyCardTitle, classicPartyCardCodeWrap,
  classicPartyCardCode, classicPartyCardCodeInput, classicPartyCardSearch, classicPartyCardName,
  classicPartyCardBody, classicPartyCardField, classicPartyCardFieldLabel, classicPartyCardFieldValue,
  classicRightGrid, classicLabel, classicInput, classicReadInput, metalWin, metalTopInlineRow,
  metalTopField, normalizeLineType, isMetalStockVoucherType,
} from './voucherTabShared'

export default function VoucherEditorPanel({
  applyLineAutoCalc,
  applyProductTypeAutoFill,
  attachmentInputKey,
  baseCurrencyCode,
  canApproveWorkflow,
  canCreate,
  canDeleteCurrentVoucher,
  canPostWorkflow,
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
  formReadOnly,
  handleAddLineClick,
  handleAmountFC,
  handleAmountLC,
  handleBarcodeAction,
  handleCancelChanges,
  handleCurrRateChange,
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
  lineAccountComboGroups,
  lineForm,
  lineItems,
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
  partyComboGroups,
  receiptPaymentNetAmtLabelCurrency,
  recentPartyVouchers,
  refreshParties,
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
                padding: '1rem',
              }
            : undefined}
          onClick={(mode === 'create' || mode === 'view') ? handleVoucherModalBackdropClick : undefined}
        >
          <div
            style={(mode === 'create' || mode === 'view')
              ? {
                  width: isMetalVoucher ? 'min(1160px, 96vw)' : 'min(1180px, 96vw)',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  background: isMetalVoucher ? '#E3E6EB' : S.white,
                  borderRadius: '0.7rem',
                  border: isMetalVoucher ? metalWin.shell.border : '2px solid #4F73AB',
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
            <div style={{ width: 60 }} />
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'center', letterSpacing: '.2px', textShadow: '0 1px 0 rgba(0,0,0,0.28)' }}>
              {voucherLabelT}{header.vocNo ? ` — #${header.vocNo}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {['─', '□'].map((ch) => (
                <button key={ch} type="button" style={{ width: 18, height: 15, background: 'linear-gradient(180deg,#D8DCE3,#A9B2C1)', border: '1px solid #6F7B8B', borderTop: '1px solid #EFF3F8', borderLeft: '1px solid #E5EAF1', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#1F2937', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}>{ch}</button>
              ))}
              <button
                type="button"
                title="Close"
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  e.stopPropagation()
                  handleExitVoucherForm()
                }}
                onClick={(e) => {
                  e.preventDefault()
                }}
                style={{ width: 18, height: 15, background: 'linear-gradient(180deg,#E3D8D8,#C4A0A0)', border: '1px solid #8A6F6F', borderTop: '1px solid #F4E9E9', borderLeft: '1px solid #EFDDDD', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#3F1D1D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── ERP Classic Toolbar ── */}
          {(() => {
            const compactMetalTb = false
            const tbS = {
              minWidth: compactMetalTb ? 24 : 68,
              width: compactMetalTb ? 24 : undefined,
              height: compactMetalTb ? 22 : 24,
              background: 'linear-gradient(180deg,#FBFBFB 0%,#E5E5E5 48%,#CACACA 100%)',
              border: '1px solid #A9A9A9',
              borderTop: '1px solid #F8F8F8',
              borderLeft: '1px solid #ECECEC',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: compactMetalTb ? 10 : 10.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 1px 1px 1px rgba(0,0,0,0.22)',
              color: '#222',
              padding: compactMetalTb ? 0 : '0 7px',
              flexShrink: 0,
              whiteSpace: compactMetalTb ? 'normal' : 'nowrap',
            }
            const TbBtn = ({ tip, label, icon, onClick, style: extra = {}, disabled = false }) => (
              <button
                type="button"
                title={tip}
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
                {compactMetalTb ? icon : label}
              </button>
            )
            const Sep = () => <div style={{ width: 1, height: 20, background: '#b0b0b0', margin: '0 3px', flexShrink: 0 }} />
            const curIdx = vouchers.findIndex(v => v._id === editingId)
            return (
              <div style={{
                background: isMetalVoucher
                  ? 'linear-gradient(180deg,#F0F0F0,#D7D7D7)'
                  : 'linear-gradient(180deg,#F0F0F0,#D7D7D7)',
                borderBottom: isMetalVoucher ? '2px solid #9C9C9C' : '2px solid #9C9C9C',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                marginBottom: '0.6rem',
              }}>
                <TbBtn tip="New — opens a blank form to enter a new voucher" label="New" onClick={() => openCreate()} disabled={!canCreate} />
                <TbBtn tip="Edit — unlocks the current record for modification" label="Edit" onClick={handleEditUnlock} disabled={isReadOnly || (!editingId && mode !== 'create')} />
                <TbBtn tip="Delete — removes the current voucher" label="Delete" onClick={handleDeleteVoucher} style={{ color: '#b00020' }} disabled={isReadOnly || (Boolean(editingId) && !canDeleteCurrentVoucher)} />
                <TbBtn tip="Save — saves your data permanently" label="Save" onClick={saveVoucher} style={{ color: '#065f46' }} disabled={formReadOnly} />
                <TbBtn tip="Cancel — discards unsaved changes" label="Cancel" onClick={handleCancelChanges} />
                <Sep />
                <TbBtn tip="|◀ First — jumps to the very first voucher on record" label="|◀ First" icon="⏮" onClick={navFirst} disabled={curIdx <= 0} />
                <TbBtn tip="◀ Previous — goes one record back" label="◀ Previous" icon="◀" onClick={navPrev} disabled={curIdx <= 0} />
                <TbBtn tip="▶ Next — goes one record forward" label="▶ Next" icon="▶" onClick={navNext} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <TbBtn tip="▶| Last — jumps to the most recent voucher" label="▶| Last" icon="⏭" onClick={navLast} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <Sep />
                <TbBtn tip="Print/Preview — prints or previews the current invoice" label="Print/Preview" onClick={() => window.print()} />
                <TbBtn tip="Search/Find — search by voucher number, party, or date" label="Search/Find" onClick={handleSearchFind} />
                <TbBtn tip="Barcode — scan or view an item barcode linked to stock" label="Barcode" onClick={handleBarcodeAction} />
                <TbBtn tip="Refresh Parties — reload customer and vendor list" label="↺ Parties" onClick={refreshParties} />
                <Sep />
                <TbBtn tip="Exit — closes the voucher form and returns to the main menu" label="Exit" icon="■" onClick={handleExitVoucherForm} style={{ color: '#b00020' }} />
                <div style={{ flex: 1 }} />
              </div>
            )
          })()}

          {/* ── Body padding wrapper ── */}
          <div style={isMetalVoucher ? metalWin.body : { padding: '0.75rem 0.9rem' }}>

          {/* ── Voucher section menu ── */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0', flexWrap: 'wrap', alignItems: 'flex-end', padding: '0 0.15rem', borderBottom: '1px solid #BFC5CB' }}>
            <button style={tabBtn(menuTab === 'header')} onClick={() => setMenuTab('header')}>
              {isMetalVoucher ? 'Stock Details' : 'Header Details'}
            </button>
            <button style={tabBtn(menuTab === 'attachments')} onClick={() => setMenuTab('attachments')}>
              {t('attachments')}
            </button>
          </div>

          {/* ── Header Details ── */}
          {menuTab === 'header' && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                {isMetalVoucher && (
                  <div style={metalTopInlineRow}>
                    <div style={metalTopField}>
                      <label style={classicLabel}>Party Account</label>
                      <AccountCombobox
                        groups={metalPartyComboGroups}
                        value={selectedPartyId}
                        onChange={(val) => handlePartySelect(val)}
                        placeholder="Type account name or code…"
                        style={formReadOnly ? classicReadInput : classicInput}
                        disabled={formReadOnly}
                      />
                    </div>
                  </div>
                )}
                <div style={classicHeaderShell}>
                  <div style={classicHeaderGrid}>
                    <div style={{ ...classicPanel, flex: '0 1 640px', minWidth: '320px' }}>
                      <div style={classicPanelTitle}>Party Details</div>
                      <div style={classicPartyGrid}>
                        {!isMetalVoucher && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={classicLabel}>Party Account</label>
                            <AccountCombobox
                              groups={partyComboGroups}
                              value={selectedPartyId}
                              onChange={(val) => handlePartySelect(val)}
                              placeholder="Type account name or code…"
                              style={formReadOnly ? classicReadInput : classicInput}
                              disabled={formReadOnly}
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={classicLabel}>Party Code</label>
                          <input
                            style={formReadOnly ? classicReadInput : classicInput}
                            value={header.partyCode}
                            onChange={e => setHdr('partyCode', e.target.value)}
                            onKeyDown={handlePartyCodeEnter}
                            placeholder={voucherConfig.partyPlaceholder}
                            readOnly={formReadOnly}
                          />
                        </div>
                      </div>
                      {(() => {
                        const resolvedParty = resolveVoucherParty(header.partyCode)
                        const partyCardTitle = resolvedParty?.partyType === 'vendor'
                          ? 'Vendor Details'
                          : resolvedParty?.partyType === 'customer'
                            ? 'Customer Details'
                            : 'Party Details'
                        const partyDisplayName = resolvedParty?.partyName || header.partyName || 'No party selected'
                        const partyEmail = resolvedParty?.email || '—'
                        const partyPhone = resolvedParty?.phone || '—'
                        const partyAddress = resolvedParty?.address || '—'

                        return (
                          <div style={classicPartyCard}>
                            <div style={classicPartyCardHeader}>
                              <div style={classicPartyCardTitle}>{partyCardTitle}</div>
                              <div style={classicPartyCardCodeWrap}>
                                <div style={classicPartyCardCode}>
                                  <input
                                    style={classicPartyCardCodeInput}
                                    value={header.partyCode}
                                    onChange={e => setHdr('partyCode', e.target.value)}
                                    onKeyDown={handlePartyCodeEnter}
                                    placeholder="Code"
                                    readOnly={formReadOnly}
                                  />
                                </div>
                                <button
                                  type="button"
                                  style={classicPartyCardSearch}
                                  onClick={searchPartyByCode}
                                  disabled={formReadOnly}
                                  title="Search party by code"
                                >
                                  ⌕
                                </button>
                              </div>
                            </div>
                            <div style={classicPartyCardName}>{partyDisplayName}</div>
                            <div style={classicPartyCardBody}>
                              <div style={classicPartyCardField}>
                                <span style={classicPartyCardFieldLabel}>Email</span>
                                <span style={classicPartyCardFieldValue}>{partyEmail}</span>
                              </div>
                              <div style={classicPartyCardField}>
                                <span style={classicPartyCardFieldLabel}>Phone</span>
                                <span style={classicPartyCardFieldValue}>{partyPhone}</span>
                              </div>
                              <div style={{ ...classicPartyCardField, gridColumn: '1 / -1' }}>
                                <span style={classicPartyCardFieldLabel}>Address</span>
                                <span style={classicPartyCardFieldValue}>{partyAddress}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <div style={{ ...classicPanel, flex: '0 1 430px', minWidth: '300px' }}>
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
                          style={formReadOnly ? classicReadInput : classicInput}
                          type="date"
                          value={header.docDate}
                          onChange={e => setHdr('docDate', e.target.value)}
                          readOnly={formReadOnly}
                        />

                        {!isSimpleMetalVoucher && (
                          <>
                            <label style={classicLabel}>Value Date :</label>
                            <input
                              style={formReadOnly ? classicReadInput : classicInput}
                              type="date"
                              value={header.valueDate}
                              onChange={e => setHdr('valueDate', e.target.value)}
                              readOnly={formReadOnly}
                            />

                            <label style={classicLabel}>Curr. Code :</label>
                            <select
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.currCode}
                              onChange={e => handleHeaderCurrencyChange(e.target.value)}
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
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.currRate}
                              onChange={e => handleHeaderCurrRateChange(e.target.value)}
                              type="number"
                              step="0.000001"
                              title="AED auto-default: 3.674 (you can edit manually)"
                              readOnly={formReadOnly}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{item.currency} {fmt(item.amount)}</td>
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
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.metalAmount)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(l.totalAmount || l.amountLC)}</td>
                                </>
                              )}
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration || l.remarks || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.acCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.type}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.currCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountFC)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountLC)}</td>
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
            <div style={sectionBox}>
              <div style={{ ...(isMetalVoucher ? { ...classicPanelTitle, ...metalWin.tabLabel } : classicPanelTitle), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{isMetalVoucher ? 'Stock Details' : 'LINE ITEMS'}</span>
              </div>

              {/* Line items table */}
              <div style={{ overflowX: 'auto', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #C9CED6', background: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={isMetalVoucher ? metalWin.headerRow : { background: 'linear-gradient(180deg, #F8F9FB 0%, #E7EAF0 100%)' }}>
                      {lineTableHeaders.map(h => (
                        <th key={h} style={{ padding: '0.34rem 0.48rem', textAlign: ['Amount FC', 'Amount LC', 'Metal Rate', 'Metal Amount', 'Total', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.'].includes(h) ? 'right' : 'left', fontWeight: '700', color: isMetalVoucher ? '#374151' : '#374151', borderBottom: isMetalVoucher ? '1px solid #C9CED6' : '1px solid #C9CED6', borderRight: isMetalVoucher ? '1px solid #E5E7EB' : '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={lineTableHeaders.length} style={{ padding: '1rem', textAlign: 'center', color: S.muted, borderBottom: '1px solid #D7DBE0' }}>
                          {formReadOnly ? 'No line items.' : 'Click "Add" below to add entries.'}
                        </td>
                      </tr>
                    ) : lineItems.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FBFBFC', borderBottom: isMetalVoucher ? metalWin.tableCell.borderBottom : '1px solid #D7DBE0' }}>
                        <td style={{ padding: '0.28rem 0.48rem', borderRight: isMetalVoucher ? metalWin.tableCell.borderRight : '1px solid #EEF1F4', background: isMetalVoucher ? metalWin.tableCell.background : undefined }}>{i + 1}</td>
                        {isMetalVoucher ? (
                          <>
                            <td style={{ padding: '0.28rem 0.48rem', fontWeight: '600', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.stockCode || '-'}</td>
                            {isSimpleMetalVoucher && (
                              <td style={{ padding: '0.28rem 0.48rem', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.productType || '-'}</td>
                            )}
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pcs || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.grossWeight || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.purity || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pureWeight || '-'}</td>
                            {!isSimpleMetalVoucher && (
                              <>
                                <td style={{ padding: '0.28rem 0.48rem', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.rateType || '-'}</td>
                                <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(parseFloat(l.metalRate) || ((parseFloat(l.weightInOz) || 0) > 0 ? ((parseFloat(l.metalAmount) || 0) / (parseFloat(l.weightInOz) || 0)) : 0))}</td>
                                <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.metalAmount)}</td>
                                <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', fontWeight: '700', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.totalAmount || l.amountLC)}</td>
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
                            <td style={{ padding: '0.28rem 0.48rem', borderRight: '1px solid #EEF1F4' }}>{l.currCode}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountFC)}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountLC)}</td>
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
                  <div style={{ ...classicPanelTitle }}>
                    {editingLineIdx !== null ? 'Edit Line Item' : 'Add Line Item'}
                  </div>
                  <div style={{ padding: '0.5rem 0.55rem' }}>

                  {isMetalVoucher ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '1fr' : '2.35fr 1.25fr auto', gap: '0.75rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                        <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '110px minmax(180px, 1fr)' : '110px minmax(180px, 1fr) 90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, background: S.headerBg }}>Stock *</div>
                            <select
                              style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }}
                              value={lineForm.stockCode}
                              onChange={(e) => handleStockSelection(e.target.value)}
                            >
                              <option value="">{loadingInventoryProducts ? 'Loading stock...' : 'Select stock'}</option>
                              {inventoryStockOptions.map((option) => (
                                <option key={option.code} value={option.code}>{option.label}</option>
                              ))}
                            </select>
                            {!isSimpleMetalVoucher && (
                              <>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>Location</div>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.location} onChange={e => setLF('location', e.target.value)} />
                              </>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, background: S.headerBg }}>Product Type</div>
                            <select
                              style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }}
                              value={lineForm.productType}
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
                              {inventoryProducts
                                .filter(p => String(p.category || '').includes('recordType=product'))
                                .map(p => <option key={p._id} value={p.name}>{p.name}</option>)
                              }
                            </select>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>PCS</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="1" value={lineForm.pcs} onChange={e => setLineForm(prev => applyProductTypeAutoFill({ ...prev, pcs: e.target.value }))} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '110px minmax(90px, 1fr)' : '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Gross Weight</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.grossWeight} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, grossWeight: e.target.value }))} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Purity</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.purity} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, purity: e.target.value }))} />
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>Pure Weight</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.pureWeight} onChange={e => { const pw = parseFloat(e.target.value) || 0; setLineForm(prev => applyLineAutoCalc({ ...prev, pureWeight: e.target.value, weightInOz: pw > 0 ? (pw / 31.1034768).toFixed(3) : '' })) }} />
                          </div>
                          {!isSimpleMetalVoucher && (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Weight In OZ.</div>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} value={lineForm.weightInOz || ((parseFloat(lineForm.pureWeight) || 0) > 0 ? ((parseFloat(lineForm.pureWeight) || 0) / 31.1034768).toFixed(3) : '')} onChange={e => setLF('weightInOz', e.target.value)} />
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }} />
                                <div style={{ borderLeft: `1px solid ${S.border}`, background: '#F9FAFB' }} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Tax Type</div>
                                <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.vatType || 'VAT'} onChange={e => setLF('vatType', e.target.value)}>
                                  <option value="VAT">VAT</option>
                                  <option value="GST">GST</option>
                                  <option value="Sales Tax">Sales Tax</option>
                                  <option value="None">None</option>
                                </select>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }} />
                                <div style={{ borderLeft: `1px solid ${S.border}`, background: '#F9FAFB' }} />
                              </div>
                            </>
                          )}

                        </div>

                        {!isSimpleMetalVoucher && (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Making / Margin</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate Type</div>
                              <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)}>
                                <option value="OZ">OZ</option>
                                <option value="GRAM">GRAM</option>
                                <option value="KG">KG</option>
                              </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }}
                                type="number"
                                step="0.01"
                                value={lineForm.metalRate}
                                onChange={e => setLF('metalRate', e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Amount</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', background: '#F9FAFB' }}
                                type="number"
                                step="0.01"
                                value={lineForm.metalAmount}
                                readOnly
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderTop: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Purity Diff</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.purityDiff} onChange={e => setLF('purityDiff', e.target.value)} />
                            </div>
                          </div>

                          <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Premium Values</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Premi. Curr.</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(44px, 1fr)' }}>
                                <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.25rem' }} value={lineForm.currCode} onChange={e => handleLineCurrencyChange(e.target.value)}>
                                  {currencyOptions.length === 0 ? (
                                    <option value="USD">USD</option>
                                  ) : currencyOptions.map((item) => (
                                    <option key={item.code} value={item.code}>{item.code}</option>
                                  ))}
                                </select>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.35rem', textAlign: 'right' }} type="number" step="0.000001" value={lineForm.premiumValue} onChange={e => setLF('premiumValue', e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(44px, 1fr)' }}>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.25rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} />
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.35rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLF('metalRate', e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Total (FC)</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} readOnly value={lineForm.metalAmount || ''} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Total (LC)</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} readOnly value={lineForm.totalAmount || lineForm.amountLC || ''} />
                            </div>
                          </div>
                        </div>
                        )}

                        {!isSimpleMetalVoucher && (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          <div style={{ border: `1px solid ${S.border}`, background: S.white, minWidth: '180px' }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Metal Rate & Amount</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate Type</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, metalRate: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Metal Amt</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', color: '#991B1B', fontWeight: '700', background: '#F9FAFB' }} type="number" step="0.01" value={lineForm.metalAmount} readOnly />
                            </div>
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Premium Amt</div>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', background: '#F9FAFB' }} type="number" step="0.01" value={lineForm.premiumAmount || ''} readOnly />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                                <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Making Chg.</div>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.makingCharges} onChange={e => setLF('makingCharges', e.target.value)} />
                              </div>
                            </>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>Total</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', fontWeight: '700', background: '#F9FAFB' }}
                                type="number"
                                step="0.01"
                                value={lineForm.totalAmount}
                                readOnly
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>Total Amt+Tax</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', fontWeight: '700' }}
                                readOnly
                                value={lineForm.amountWithVAT || ''}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '0.35rem' }}>
                            <button style={{ ...btn('gray'), minWidth: '92px' }} onClick={() => {
                              saveLine()
                              if (!lineForm.stockCode.trim()) return
                              setTimeout(() => openAddLine(), 50)
                            }}>
                              Continue
                            </button>
                            <button style={{ ...btn('primary'), minWidth: '92px' }} onClick={saveLine}>Save</button>
                            <button style={{ ...btn('secondary'), minWidth: '92px' }} onClick={cancelLine}>Cancel</button>
                          </div>
                        </div>
                        )}
                      </div>

                      {isSimpleMetalVoucher && (
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.55rem' }}>
                          <button style={{ ...btn('gray'), minWidth: '92px' }} onClick={() => {
                            saveLine()
                            if (!lineForm.stockCode.trim()) return
                            setTimeout(() => openAddLine(), 50)
                          }}>
                            Continue
                          </button>
                          <button style={{ ...btn('primary'), minWidth: '92px' }} onClick={saveLine}>Save</button>
                          <button style={{ ...btn('secondary'), minWidth: '92px' }} onClick={cancelLine}>Cancel</button>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: isSimpleMetalVoucher ? '1fr' : '1fr 180px', gap: '0.55rem', marginBottom: '0.2rem' }}>
                        <div>
                          <label style={labelStyle}>Narration</label>
                          <input style={inputStyle} value={lineForm.narration} onChange={e => setLF('narration', e.target.value)} />
                        </div>
                        {!isSimpleMetalVoucher && (
                          <div>
                            <label style={labelStyle}>Silver Purity %</label>
                            <input style={inputStyle} type="number" step="0.01" value={lineForm.silverPurity} onChange={e => setLF('silverPurity', e.target.value)} />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ border: '1px solid #C9CED6', borderRadius: '0.15rem', overflow: 'visible', background: '#FFFFFF', fontSize: '0.78rem' }}>
                      {/* Row 1: Type | A/C Code | Curr | Rate */}
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 96px 1.6fr 58px 1fr 60px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Type</div>
                        <select style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB' }} value={lineForm.type} onChange={e => handleLineTypeChange(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="TT">TT</option>
                          <option value="Card">Card</option>
                        </select>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>A/C Code *</div>
                        <AccountCombobox
                          groups={lineAccountComboGroups}
                          value={lineForm.acCode || ''}
                          onChange={(val) => handleLineAcCodeChange(val)}
                          placeholder="— Select Account —"
                          style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }}
                          disabled={formReadOnly}
                        />
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Curr</div>
                        <select style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB' }} value={lineForm.currCode} onChange={e => handleLineCurrencyChange(e.target.value)}>
                          {currencyOptions.length === 0 ? (
                            <option value="USD">USD</option>
                          ) : currencyOptions.map((item) => (
                            <option key={item.code} value={item.code}>{item.code}</option>
                          ))}
                        </select>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Rate</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', width: '100%' }} type="text" inputMode="decimal" value={lineForm.currRate} onChange={e => handleCurrRateChange(e.target.value)} placeholder={header.currRate} />
                        </div>
                      {/* Ref Rate row - shows for payment/receipt with non-base foreign currency */}
                      {['payment', 'receipt'].includes(String(voucherType || '').toLowerCase()) &&
                        String(lineForm.currCode || 'USD').toUpperCase() !== baseCurrencyCode && (
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', borderBottom: '1px solid #E5E7EB', background: '#FFFBEB' }}>
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontWeight: '700', fontSize: '0.7rem', color: '#92400E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Ref Rate</div>
                          <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFFBEB', outline: 'none', textAlign: 'right', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.referenceRate || ''} onChange={e => setLF('referenceRate', e.target.value)} placeholder="Original invoice rate" />
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontSize: '0.68rem', color: '#92400E', borderRight: '1px solid #DDE1E8', display: 'flex', alignItems: 'center' }}></div>
                          <div style={{ padding: '0.26rem 0.45rem', fontSize: '0.68rem', color: '#92400E', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>Rate when obligation was created (for FX gain/loss)</div>
                        </div>
                      )}
                      {/* Amount row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Amt FC</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.amountFC} onChange={e => handleAmountFC(e.target.value)} onKeyDown={handleLineAmountEnter} />
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Amt LC *</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.amountLC} onChange={e => handleAmountLC(e.target.value)} onKeyDown={handleLineAmountEnter} />
                      </div>

                      {/* Narration row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Narration</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', width: '100%', boxSizing: 'border-box' }} value={lineForm.narration} onChange={e => setLF('narration', e.target.value)} />
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.32rem 0.55rem', background: 'linear-gradient(180deg, #F3F4F6 0%, #E8EAED 100%)', borderTop: '1px solid #D4D8DE' }}>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)' }} onClick={() => { saveLine(); if (!lineForm.acCode.trim()) return; setTimeout(() => openAddLine(), 50) }}>Continue</button>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #16A34A 0%, #059669 100%)', border: '1px solid #047857', borderRadius: '0.15rem', cursor: 'pointer', color: '#FFF', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} onClick={saveLine}>Save</button>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)' }} onClick={cancelLine}>Cancel</button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}

              {/* ── Bottom strip: Actions + Remarks + Amount Summary ── */}
              <div style={{ borderTop: '2px solid #B8BEC8', background: 'linear-gradient(180deg, #F4F5F7 0%, #E8EAED 100%)', padding: '0.38rem 0.55rem' }}>
                <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  {/* Left: Add/Edit/Delete + Remarks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem', flex: 1 }}>
                    {!isReadOnly && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          style={{ padding: '0.2rem 0.72rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 1px 1px rgba(0,0,0,0.06)' }}
                          onClick={handleAddLineClick}
                        >Add</button>
                      </div>
                    )}

                  </div>
                  {/* Right: Amount Summary / Total Summary */}
                  <div style={{ border: '1px solid #8EA0C5', borderRadius: '0.15rem', background: '#FFFFFF', minWidth: '245px', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ ...(isMetalVoucher ? metalWin.summaryHeader : { background: 'linear-gradient(180deg, #E8EAED 0%, #D4D8DF 100%)', color: '#374151' }), borderBottom: isMetalVoucher ? `1px solid ${S.greenDark}` : '1px solid #8EA0C5', padding: '0.2rem 0.65rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{isSimpleMetalVoucher ? 'Total Summary' : 'Amount Summary'}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                      <tbody>
                        {isSimpleMetalVoucher && (
                          <>
                            <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                              <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Gross Weight :</td>
                              <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{totals.grossWeightTotal > 0 ? totals.grossWeightTotal.toFixed(3) : '0.000'}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                              <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Pure Weight :</td>
                              <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{totals.pureWeightTotal > 0 ? totals.pureWeightTotal.toFixed(3) : '0.000'}</td>
                            </tr>
                            <tr style={{ background: '#F1F3F6' }}>
                              <td style={{ padding: '0.24rem 0.65rem', color: '#111827', fontWeight: '700' }}>Total PCS :</td>
                              <td style={{ padding: '0.24rem 0.65rem', textAlign: 'right', fontWeight: '800', color: S.green, fontSize: '0.87rem' }}>{totals.pcsTotal > 0 ? Math.round(totals.pcsTotal).toLocaleString('en-US') : '0'}</td>
                            </tr>
                          </>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Metal Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.metalTotal)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && totals.premiumTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Premium Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.premiumTotal)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && totals.makingTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Making Charges :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.makingTotal)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Gross Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.total)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>VAT Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.vatAmount)}</td>
                          </tr>
                        )}
                        {!isSimpleMetalVoucher && (
                        <tr style={{ background: '#F1F3F6' }}>
                          <td style={{ padding: '0.24rem 0.65rem', color: '#111827', fontWeight: '700' }}>{`Net Amt (${receiptPaymentNetAmtLabelCurrency || header.currCode || 'USD'}) :`}</td>
                          <td style={{ padding: '0.24rem 0.65rem', textAlign: 'right', fontWeight: '800', color: S.green, fontSize: '0.87rem' }}>{fmt(totals.grandTotal)}</td>
                        </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
              styles={{ sectionBox, sectionHeader, sectionBody, btn, S }}
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
                      placeholder="Optional note for submit / approve / post"
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
                    {canApproveWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('approve')} style={{ ...btn('gray'), background: '#0EA5E9', color: '#FFFFFF' }}>
                        {t('approve')}
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
                    {canPostWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('post')} style={{ ...btn('primary') }}>
                        {t('post')}
                      </button>
                    )}
                    {canRevalueCurrentVoucher && (
                      <button type="button" disabled={saving} onClick={() => handleRevalueFxJournal(currentVoucher)} style={{ ...btn('gray'), background: '#E0F2FE', color: '#0C4A6E' }}>
                        Revalue FX Journal
                      </button>
                    )}
                    {!canSubmitWorkflow && !canApproveWorkflow && !canReturnWorkflow && !canRejectWorkflow && !canPostWorkflow && (
                      <span style={{ color: S.muted, fontSize: '0.82rem' }}>No workflow action available for your role or current status.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${S.border}` }}>
              <button
                style={{ ...btn('primary'), opacity: saving ? 0.7 : 1 }}
                onClick={saveVoucher}
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingId ? '💾 Update Voucher' : '💾 Save Voucher')}
              </button>
              <button style={btn('secondary')} onClick={() => setMode('list')}>
                {t('cancel')}
              </button>
            </div>
          )}
          {isReadOnly && (
            <div style={{ marginTop: '0.75rem' }}>
              <button style={btn('secondary')} onClick={() => setMode('list')}>← Back</button>
            </div>
          )}
          </div>
          </div>
        </div>
      )}
    </>
  )
}
