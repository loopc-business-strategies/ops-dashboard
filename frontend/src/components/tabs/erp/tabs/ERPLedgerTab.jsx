import JournalVoucherModal from './JournalVoucherModal'
import {
  groupJvLedgerEntries,
  inferLegacyJvBatchDisplayFc,
  normalizeJvCurrencyCode,
} from '../journalVoucherHelpers'
import { filterActiveAccounts } from '../accountDropdownHelpers'

export default function ERPLedgerTab({
  activeTab,
  C,
  canManageAccounts,
  showLedgerForm,
  openJvModal,
  ledgerVoucherTab,
  setLedgerVoucherTab,
  JV_MODE_META,
  resolveJvModeMeta,
  jvMode,
  getJvValidation,
  jvLines,
  baseCurrencyCode,
  closeJvModal,
  jvModalSize,
  jvModalOffset,
  jvModalDrag,
  jvModalResize,
  beginJvModalDrag,
  switchJvMode,
  jvEditEntryIds,
  currencies,
  jvHeader,
  setJvHeader,
  bankJvComboGroups,
  jvComboGroups,
  resolveJvLineAccount,
  handleJvAccountKeyDown,
  updateJvLine,
  handleJvLineKeyDown,
  removeJvLine,
  addJvLine,
  handlePrintJvVoucher,
  handleSaveMultiLineJV,
  saving,
  jvError,
  beginJvModalResize,
  ledgerFilters,
  setLedgerFilters,
  modalInputStyle,
  LEDGER_DEPARTMENTS,
  LEDGER_REFERENCE_TYPES,
  accounts,
  sorting,
  setSorting,
  ledger,
  ledgerMeta,
  loadLedger,
  jvReadOnly,
  handleOpenJv,
  handleEditJv,
  handleEditLedger: _handleEditLedger,
  handleReverseLedger,
  isFinance,
  handleRepairJvFxPreview,
  handleRepairJvFxApply,
}) {
  const activeAccounts = filterActiveAccounts(accounts)
  const visibleJvLedgerEntries = activeTab === 'ledger'
    ? ledger.filter((entry) => String(entry.referenceType || '').toLowerCase() === ledgerVoucherTab)
    : []
  const groupedJvVouchers = groupJvLedgerEntries(visibleJvLedgerEntries, { baseCurrencyCode })

  return (
    <>
      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Journal Voucher</h3>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {Object.entries(JV_MODE_META).map(([mode, meta]) => {
                const active = ledgerVoucherTab === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLedgerVoucherTab(mode)}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${active ? '#1E40AF' : '#CBD5E1'}`,
                      background: active ? '#DBEAFE' : '#F8FAFC',
                      color: active ? '#1E3A8A' : '#334155',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
            {isFinance && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { void handleRepairJvFxPreview() }}
                  title="Dry-run: how many legacy journal/bank_jv rows would get UZS + rate"
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #94A3B8',
                    background: '#F1F5F9',
                    color: '#0F172A',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  Preview JV FX repair
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { void handleRepairJvFxApply() }}
                  title="Writes UZS + exchangeRate on legacy rows (needs maintenance token)"
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #B45309',
                    background: '#FFFBEB',
                    color: '#92400E',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  Apply JV FX repair
                </button>
              </div>
            )}
            {canManageAccounts && (
              <button
                onClick={() => { if (!showLedgerForm) void openJvModal(ledgerVoucherTab) }}
                disabled={showLedgerForm}
                style={{
                  padding: '0.5rem 1rem',
                  background: showLedgerForm ? '#9CA3AF' : C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: showLedgerForm ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                {ledgerVoucherTab === 'bank_jv' ? '+ New Bank JV' : '+ New Journal Voucher'}
              </button>
            )}
          </div>
          {showLedgerForm && (
            <JournalVoucherModal
              C={C}
              JV_MODE_META={JV_MODE_META}
              resolveJvModeMeta={resolveJvModeMeta}
              jvMode={jvMode}
              getJvValidation={getJvValidation}
              jvLines={jvLines}
              baseCurrencyCode={baseCurrencyCode}
              closeJvModal={closeJvModal}
              jvModalSize={jvModalSize}
              jvModalOffset={jvModalOffset}
              jvModalDrag={jvModalDrag}
              jvModalResize={jvModalResize}
              beginJvModalDrag={beginJvModalDrag}
              switchJvMode={switchJvMode}
              jvEditEntryIds={jvEditEntryIds}
              currencies={currencies}
              jvHeader={jvHeader}
              setJvHeader={setJvHeader}
              bankJvComboGroups={bankJvComboGroups}
              jvComboGroups={jvComboGroups}
              resolveJvLineAccount={resolveJvLineAccount}
              handleJvAccountKeyDown={handleJvAccountKeyDown}
              updateJvLine={updateJvLine}
              handleJvLineKeyDown={handleJvLineKeyDown}
              removeJvLine={removeJvLine}
              addJvLine={addJvLine}
              handlePrintJvVoucher={handlePrintJvVoucher}
              handleSaveMultiLineJV={handleSaveMultiLineJV}
              saving={saving}
              jvError={jvError}
              beginJvModalResize={beginJvModalResize}
              jvReadOnly={jvReadOnly}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="date"
              value={ledgerFilters.startDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              style={modalInputStyle}
            />
            <input
              type="date"
              value={ledgerFilters.endDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              style={modalInputStyle}
            />
            <select
              value={ledgerFilters.department}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, department: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Departments</option>
              {LEDGER_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.referenceType}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Types</option>
              {LEDGER_REFERENCE_TYPES.map((referenceType) => (
                <option key={referenceType} value={referenceType}>{referenceType}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.accountId}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, accountId: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Accounts</option>
              {activeAccounts.map((account) => (
                <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
              ))}
            </select>
            <button
              onClick={() => setLedgerFilters({ startDate: '', endDate: '', department: '', referenceType: '', accountId: '' })}
              style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content' }}
            >
              Reset Filters
            </button>
          </div>
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            {(() => {
              const pagedLedgerEntries = [...groupedJvVouchers]
                .sort((a, b) => {
                  if (sorting.ledger.by === 'date') {
                    return sorting.ledger.asc ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)
                  } else if (sorting.ledger.by === 'amount') {
                    return sorting.ledger.asc ? a.totalBaseAmount - b.totalBaseAmount : b.totalBaseAmount - a.totalBaseAmount
                  }
                  return 0
                })

              return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'date', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'date' ? C.p2 : 'transparent' }}>Date {sorting.ledger.by === 'date' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', minWidth: '110px' }}>Voucher No.</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', maxWidth: '220px' }}>Narration / detail</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'amount', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'amount' ? C.p2 : 'transparent' }}>Amount {sorting.ledger.by === 'amount' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLedgerEntries
                  .map((voucher) => {
                    const entry = voucher.representative
                    const voucherNo = voucher.voucherNo
                    const narrDetail = voucher.narration
                    const isBankJv = String(voucher.referenceType || '').toLowerCase() === 'bank_jv'
                    return (
                    <tr key={voucher.key} style={{ borderBottom: `1px solid ${C.p2}`, background: isBankJv ? '#F0F9FF' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{new Date(voucher.date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '700', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{voucherNo}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.78rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={narrDetail}>{narrDetail}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.82rem' }} title={voucher.debitAccounts}>{voucher.debitAccounts}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.82rem' }} title={voucher.creditAccounts}>{voucher.creditAccounts}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>
                        {(() => {
                          const baseSym = String(baseCurrencyCode || '').trim().toUpperCase() || 'USD'
                          const baseEq = Number(voucher.totalBaseAmount || 0)
                          const legacyFc = inferLegacyJvBatchDisplayFc(voucher.entries, baseCurrencyCode)
                          const fxRow = legacyFc
                            ? (currencies || []).find((c) => normalizeJvCurrencyCode(c?.code) === normalizeJvCurrencyCode(legacyFc))
                            : null
                          const dispRate = fxRow ? Number(fxRow.exchangeRate || 0) : 0
                          const useLegacyFc = Boolean(legacyFc && dispRate > 0)
                          const isJournalJv = String(voucher.referenceType || '').toLowerCase() === 'journal'
                          const lineHint = voucher.lineCount > 1 ? `${voucher.lineCount} ledger lines` : ''

                          if (isJournalJv && voucher.documentFaceAmount != null && voucher.documentCurrencyCode) {
                            return (
                              <div title={lineHint || undefined}>
                                <div style={{ fontWeight: '700' }}>
                                  <span>{baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{baseSym}</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>
                                  ≈ {Number(voucher.documentFaceAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {voucher.documentCurrencyCode}
                                </div>
                                {lineHint ? (
                                  <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                                ) : null}
                              </div>
                            )
                          }

                          if (isJournalJv) {
                            return (
                              <div title={lineHint || undefined}>
                                <span>{baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{baseSym}</span>
                                {lineHint ? (
                                  <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                                ) : null}
                              </div>
                            )
                          }

                          let displayAmt = baseEq
                          let displaySym = baseSym
                          if (useLegacyFc) {
                            displaySym = normalizeJvCurrencyCode(legacyFc)
                            const rawFc = baseEq / dispRate
                            displayAmt = dispRate < 0.001 ? Math.round(rawFc) : Number(rawFc.toFixed(2))
                          }

                          const isFc = displaySym && normalizeJvCurrencyCode(displaySym) !== baseSym
                          return (
                            <div title={lineHint || undefined}>
                              <span>{displayAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              {displaySym ? (
                                <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{displaySym}</span>
                              ) : null}
                              {isFc ? (
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>
                                  ≈ {baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseSym}
                                </div>
                              ) : null}
                              {lineHint ? (
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                              ) : null}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>
                        {isBankJv ? (
                          <div>
                            <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '700' }}>🏦 Bank JV</span>
                            {voucher.lineCount > 1 && (
                              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.lineCount} lines</div>
                            )}
                            {voucher.autoTxNo && <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.autoTxNo}</div>}
                            {voucher.chequeNo && <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Chq: {voucher.chequeNo}</div>}
                          </div>
                        ) : (
                          <div>
                            <span>{voucher.referenceType}</span>
                            {voucher.lineCount > 1 && (
                              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.lineCount} lines</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              void handleOpenJv(entry)
                            }}
                            title="Open voucher (read-only)"
                            style={{ padding: '0.35rem 0.5rem', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => {
                              void handleEditJv(entry)
                            }}
                            title="Edit voucher"
                            style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          {voucher.attachmentUrl && (
                            <a href={`${(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${voucher.attachmentUrl}`} target="_blank" rel="noreferrer" style={{ padding: '0.35rem 0.5rem', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'none' }}>Slip</a>
                          )}
                          <button onClick={() => handleReverseLedger(voucher)} title="Remove this voucher from the ledger" style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>
              )
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>
              Showing {Number(groupedJvVouchers.length || 0).toLocaleString()} vouchers
              {visibleJvLedgerEntries.length > 0
                ? ` (${Number(visibleJvLedgerEntries.length).toLocaleString()} ledger lines loaded)`
                : ''}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={!ledgerMeta.cursorHistory?.length}
                onClick={() => {
                  const history = Array.isArray(ledgerMeta.cursorHistory) ? [...ledgerMeta.cursorHistory] : []
                  const previousCursor = history.pop() || null
                  loadLedger({ cursor: previousCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!ledgerMeta.hasMore || !ledgerMeta.nextCursor}
                onClick={() => {
                  const history = [...(ledgerMeta.cursorHistory || []), ledgerMeta.cursor || null]
                  loadLedger({ cursor: ledgerMeta.nextCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>

          {groupedJvVouchers.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No {ledgerVoucherTab === 'bank_jv' ? 'Bank JV' : 'Journal Voucher'} entries yet.</p>}
        </div>
      )}

    </>
  )
}
