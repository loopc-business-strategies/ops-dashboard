export default function ERPTransactionsTab({
  activeTab,
  C,
  emptyCardStyle,
  transactionSummary,
  selectedTransactionId,
  setSelectedTransactionId,
  transactionFilters,
  setTransactionFilters,
  modalInputStyle,
  availableTransactionTypes,
  TRANSACTION_TYPE_LABELS,
  loadTransactions,
  handleExportTransactionsCsv,
  handleExportTransactionsXlsx,
  handleExportTransactionsPdf,
  getTransactionBulkSelectionLabel,
  selectedTransactionIds,
  setSelectedTransactionIds,
  transactionWorkflowNote,
  setTransactionWorkflowNote,
  saving,
  handleBulkTransactionAction,
  isSuperAdmin,
  isFinance,
  handleCreateTransaction,
  isTransactionEditMode,
  resetTransactionComposer,
  transactionForm,
  setTransactionForm,
  currencies,
  customers,
  vendors,
  inventoryProducts,
  mappings,
  accounts,
  selectedTransaction,
  TRANSACTION_STATUS_STYLES,
  resolveTransactionAttachmentUrl,
  transactionAttachmentInputKey,
  handleUploadTransactionAttachment,
  handleDeleteTransactionAttachment,
  handleTransactionAction,
  transactionCommentDraft,
  setTransactionCommentDraft,
  handleAddTransactionComment,
  formatTransactionCommentKind,
  formatTransactionAuditEntry,
  TRANSACTION_ACTION_LABELS,
  transactions,
  toggleVisibleTransactionSelection,
  allVisibleTransactionsSelected,
  toggleTransactionSelection,
  populateTransactionForm,
  handleDeleteTransaction,
  transactionMeta,
  loading,
}) {
  const getLineNarration = (tx) => (tx.voucherMeta?.lineItems || [])
    .map((line) => line?.narration || line?.exp || '')
    .find((value) => String(value || '').trim())

  const getTransactionPartyLabel = (tx) => {
    const partyName = tx.customerId?.name
      || tx.vendorId?.name
      || tx.voucherMeta?.partyName
      || tx.voucherMeta?.lineItems?.find((line) => line?.acCode)?.acCode
      || tx.inventoryItemId?.sku
      || tx.inventoryItemId?.name
      || ''
    const partyCode = tx.voucherMeta?.partyCode || ''
    if (partyName && partyCode && !String(partyName).includes(partyCode)) return `${partyName} (${partyCode})`
    return partyName || partyCode || '-'
  }

  const getTransactionDescription = (tx) => (
    tx.voucherMeta?.lineItems?.find((line) => String(line?.narration || '').trim())?.narration
    || tx.voucherMeta?.lineItems?.find((line) => String(line?.exp || '').trim())?.exp
    || tx.description
    || tx.voucherMeta?.refNo
    || tx.voucherMeta?.vocNo
    || '-'
  )

  const getTransactionAttachmentLabel = (tx) => {
    const count = (tx.attachments || []).length
    return count ? `${count} file${count === 1 ? '' : 's'}` : 'No file'
  }

  return (
    <>
      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Transactions</h3>
            {selectedTransactionId && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: C.inkSoft, fontSize: '0.84rem', fontWeight: '700' }}>Linked transaction highlighted</span>
                <button onClick={() => setSelectedTransactionId('')} style={{ padding: '0.35rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}>Clear</button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem', fontWeight: '700' }}>TOTAL</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.totalCount || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.82rem' }}>Amount {Number(transactionSummary.totalAmount || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.78rem', fontWeight: '700' }}>DRAFT</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.draft || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '700' }}>SUBMITTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.submitted || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#166534', fontSize: '0.78rem', fontWeight: '700' }}>APPROVED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.approved || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#065F46', fontSize: '0.78rem', fontWeight: '700' }}>POSTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.posted || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#9D174D', fontSize: '0.78rem', fontWeight: '700' }}>RETURNED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.returned || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.78rem', fontWeight: '700' }}>REJECTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.rejected || 0).toLocaleString()}</p>
            </div>
          </div>
          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
              <input placeholder="Search narration/party/voucher/currency" value={transactionFilters.search} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, search: e.target.value }))} style={modalInputStyle} />
              <select value={transactionFilters.status} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, status: e.target.value }))} style={modalInputStyle}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="posted">Posted</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={transactionFilters.type} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, type: e.target.value }))} style={modalInputStyle}>
                <option value="">All types</option>
                {availableTransactionTypes.map((type) => <option key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</option>)}
              </select>
              <label style={{ display: 'grid', gap: '0.2rem', color: C.inkSoft, fontSize: '0.76rem', fontWeight: '700' }}>
                From date
                <input type="date" value={transactionFilters.startDate} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, startDate: e.target.value }))} style={modalInputStyle} />
              </label>
              <label style={{ display: 'grid', gap: '0.2rem', color: C.inkSoft, fontSize: '0.76rem', fontWeight: '700' }}>
                To date
                <input type="date" value={transactionFilters.endDate} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, endDate: e.target.value }))} style={modalInputStyle} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => loadTransactions({ cursor: null, cursorHistory: [] })} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Apply Filters</button>
              <button type="button" onClick={() => { const resetFilters = { search: '', status: '', type: '', startDate: '', endDate: '' }; setTransactionFilters(resetFilters); loadTransactions({ cursor: null, cursorHistory: [], ...resetFilters }) }} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Reset</button>
              <button type="button" onClick={handleExportTransactionsCsv} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #10B981', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontWeight: '700' }}>Export CSV</button>
              <button type="button" onClick={handleExportTransactionsXlsx} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B', cursor: 'pointer', fontWeight: '700' }}>Export XLSX</button>
              <button type="button" onClick={handleExportTransactionsPdf} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #EF4444', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontWeight: '700' }}>Export PDF</button>
            </div>
          </div>
          <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <div>
                <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>Bulk workflow actions</p>
                <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>{getTransactionBulkSelectionLabel(selectedTransactionIds)}</p>
              </div>
              <button type="button" onClick={() => setSelectedTransactionIds([])} style={{ padding: '0.4rem 0.7rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Clear Selection</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 2fr)', gap: '0.75rem', alignItems: 'start' }}>
              <textarea value={transactionWorkflowNote} onChange={(e) => setTransactionWorkflowNote(e.target.value)} rows={3} placeholder="Workflow note for submit / approve / post actions" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('submit')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F59E0B', color: '#111827', cursor: 'pointer', fontWeight: '700' }}>Bulk Submit</button>
                {(isSuperAdmin || isFinance) && <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('approve')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#0EA5E9', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Bulk Approve</button>}
                {(isSuperAdmin || isFinance) && <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('post')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Bulk Post</button>}
              </div>
            </div>
          </div>
          <form onSubmit={handleCreateTransaction} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div>
                <p style={{ margin: 0, color: C.ink, fontWeight: '700' }}>{isTransactionEditMode ? 'Edit transaction draft' : 'Create a new transaction draft'}</p>
                <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>Capture source transaction details, optional mapping, and account overrides in one place.</p>
              </div>
              {isTransactionEditMode && <button type="button" onClick={resetTransactionComposer} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Cancel edit</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <select value={transactionForm.type} onChange={(e) => setTransactionForm((prev) => ({ ...prev, type: e.target.value }))} style={modalInputStyle}>
                {availableTransactionTypes.map((type) => <option key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</option>)}
              </select>
              {['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) && (
                <select value={transactionForm.metalFixStatus} onChange={(e) => setTransactionForm((prev) => ({ ...prev, metalFixStatus: e.target.value }))} style={modalInputStyle}>
                  <option value="fixed">Fixing (Fixed)</option>
                  <option value="unfixed">Non-Fixing (Unfixed)</option>
                </select>
              )}
              <input type="number" step="0.01" placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))} style={modalInputStyle} />
              <input type="date" value={transactionForm.date} onChange={(e) => setTransactionForm((prev) => ({ ...prev, date: e.target.value }))} style={modalInputStyle} />
              <select value={transactionForm.currency} onChange={(e) => setTransactionForm((prev) => ({ ...prev, currency: e.target.value }))} style={modalInputStyle}>
                {(currencies.length ? currencies : [{ code: 'USD' }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input type="number" step="0.0001" min="0" placeholder="Exchange Rate" value={transactionForm.exchangeRate} onChange={(e) => setTransactionForm((prev) => ({ ...prev, exchangeRate: e.target.value }))} style={modalInputStyle} />
              <select value={transactionForm.customerId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, customerId: e.target.value }))} style={modalInputStyle}>
                <option value="">Customer (for Sales/Receipt)</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <select value={transactionForm.vendorId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, vendorId: e.target.value }))} style={modalInputStyle}>
                <option value="">Vendor (for Purchase/Payment)</option>
                {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
              <select value={transactionForm.inventoryItemId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, inventoryItemId: e.target.value }))} style={modalInputStyle}>
                <option value="">Inventory Item (optional)</option>
                {inventoryProducts.map((p) => <option key={p._id} value={p._id}>{p.sku || p.name}</option>)}
              </select>
              <select value={transactionForm.mappingId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, mappingId: e.target.value }))} style={modalInputStyle}>
                <option value="">Account Mapping (optional)</option>
                {mappings.map((m) => <option key={m._id} value={m._id}>{m.mappingType}</option>)}
              </select>
              <select value={transactionForm.debitAccountId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, debitAccountId: e.target.value }))} style={modalInputStyle}>
                <option value="">Debit Account Override</option>
                {accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>)}
              </select>
              <select value={transactionForm.creditAccountId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, creditAccountId: e.target.value }))} style={modalInputStyle}>
                <option value="">Credit Account Override</option>
                {accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>)}
              </select>
              <input placeholder="Description" value={transactionForm.description} onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))} style={modalInputStyle} />
            </div>
            <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' }}>{saving ? 'Saving...' : isTransactionEditMode ? 'Save Changes' : 'Create Transaction (Draft)'}</button>
          </form>

          {selectedTransaction && (
            <div style={{ background: '#F9FAFB', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>{TRANSACTION_TYPE_LABELS[selectedTransaction.type] || selectedTransaction.type}</p>
                  <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.85rem' }}>{getTransactionDescription(selectedTransaction) || 'No description provided'}</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '800', ...(TRANSACTION_STATUS_STYLES[selectedTransaction.status] || { background: '#E5E7EB', color: C.ink }) }}>{selectedTransaction.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
                <div style={emptyCardStyle}><strong>Amount:</strong> {selectedTransaction.currency} {Number(selectedTransaction.amount || 0).toLocaleString()}</div>
                <div style={emptyCardStyle}><strong>Date:</strong> {selectedTransaction.date ? new Date(selectedTransaction.date).toLocaleDateString() : '-'}</div>
                <div style={emptyCardStyle}><strong>Party:</strong> {getTransactionPartyLabel(selectedTransaction)}</div>
                <div style={emptyCardStyle}><strong>Narration:</strong> {getLineNarration(selectedTransaction) || selectedTransaction.description || '-'}</div>
                <div style={emptyCardStyle}><strong>Debit:</strong> {selectedTransaction.debitAccountId ? `${selectedTransaction.debitAccountId.accountCode} - ${selectedTransaction.debitAccountId.accountName}` : '-'}</div>
                <div style={emptyCardStyle}><strong>Credit:</strong> {selectedTransaction.creditAccountId ? `${selectedTransaction.creditAccountId.accountCode} - ${selectedTransaction.creditAccountId.accountName}` : '-'}</div>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div>
                    <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>Attachments</p>
                    <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.82rem' }}>Upload supporting receipts, invoices, approvals, or backup documents.</p>
                  </div>
                  <label style={{ padding: '0.5rem 0.85rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '0.35rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '700' }}>
                    Upload document
                    <input
                      key={transactionAttachmentInputKey}
                      type="file"
                      disabled={saving}
                      onChange={(e) => handleUploadTransactionAttachment(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {(selectedTransaction.attachments || []).map((attachment) => (
                    <div key={attachment._id || attachment.fileName} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <a href={resolveTransactionAttachmentUrl(attachment)} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontWeight: '700', textDecoration: 'none' }}>{attachment.originalName}</a>
                        <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>
                          {(attachment.uploadedBy?.name || 'User')} · {attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : ''} · {Number(attachment.size || 0).toLocaleString()} bytes
                        </p>
                      </div>
                      <button type="button" disabled={saving} onClick={() => handleDeleteTransactionAttachment(attachment._id)} style={{ padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.35rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer', fontWeight: '700' }}>Remove</button>
                    </div>
                  ))}
                  {!(selectedTransaction.attachments || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No documents uploaded yet.</p>}
                </div>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginTop: '0.9rem' }}>
                <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Single transaction workflow</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 1.4fr)', gap: '0.75rem', alignItems: 'start' }}>
                  <textarea value={transactionWorkflowNote} onChange={(e) => setTransactionWorkflowNote(e.target.value)} rows={3} placeholder="Workflow note or mandatory return/rejection reason" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['draft', 'returned', 'rejected'].includes(selectedTransaction.status) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('submit', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F59E0B', color: '#111827', cursor: 'pointer', fontWeight: '700' }}>Submit</button>}
                    {selectedTransaction.status === 'submitted' && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('approve', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#0EA5E9', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Approve</button>}
                    {['submitted', 'approved'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('return', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F472B6', color: '#831843', cursor: 'pointer', fontWeight: '700' }}>Return for Edit</button>}
                    {['submitted', 'approved', 'returned'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('reject', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer', fontWeight: '700' }}>Reject</button>}
                    {['submitted', 'approved'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('post', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Post</button>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(280px, 1fr)', gap: '0.85rem', marginTop: '0.9rem' }}>
                <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Comments</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                    <textarea value={transactionCommentDraft} onChange={(e) => setTransactionCommentDraft(e.target.value)} rows={3} placeholder="Add transaction comment, reviewer note, or posting note" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical', flex: '1 1 240px' }} />
                    <button type="button" disabled={saving} onClick={handleAddTransactionComment} style={{ padding: '0.5rem 0.85rem', border: 'none', background: C.s1, color: '#fff', borderRadius: '0.35rem', cursor: 'pointer', fontWeight: '700', alignSelf: 'start' }}>Add Comment</button>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                    {(selectedTransaction.comments || []).map((comment) => (
                      <div key={`${comment._id || comment.createdAt}-${comment.message}`} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>{comment.createdBy?.name || 'User'}</span>
                          <span style={{ color: C.inkSoft, fontSize: '0.76rem' }}>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p style={{ margin: '0 0 0.2rem', color: '#047857', fontSize: '0.76rem', fontWeight: '700', textTransform: 'uppercase' }}>{formatTransactionCommentKind(comment.kind)}</p>
                        <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>{comment.message}</p>
                      </div>
                    ))}
                    {!(selectedTransaction.comments || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No comments yet.</p>}
                  </div>
                </div>
                <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Approval Audit Trail</p>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                    {(selectedTransaction.auditTrail || []).slice().reverse().map((entry) => {
                      const auditEntry = formatTransactionAuditEntry(entry, TRANSACTION_ACTION_LABELS)
                      return (
                      <div key={`${entry._id || entry.createdAt}-${entry.action}`} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>{auditEntry.title}</span>
                          <span style={{ color: C.inkSoft, fontSize: '0.76rem' }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p style={{ margin: '0 0 0.2rem', color: C.inkSoft, fontSize: '0.8rem' }}>Actor: {auditEntry.actorName}</p>
                        <p style={{ margin: '0 0 0.2rem', color: C.inkSoft, fontSize: '0.8rem' }}>Status: {auditEntry.statusText}</p>
                        {auditEntry.comment && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>{auditEntry.comment}</p>}
                      </div>
                    )})}
                    {!(selectedTransaction.auditTrail || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No workflow history yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.65rem', textAlign: 'center' }}>
                    <input type="checkbox" checked={allVisibleTransactionsSelected} onChange={toggleVisibleTransactionSelection} />
                  </th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Party</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Attachments</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr id={`erp-transaction-row-${tx._id}`} key={tx._id} onClick={() => setSelectedTransactionId(tx._id)} style={{ borderBottom: `1px solid ${C.p2}`, background: selectedTransactionId === tx._id ? '#ECFDF5' : 'transparent', outline: selectedTransactionId === tx._id ? '2px solid #10B981' : 'none', outlineOffset: '-2px', cursor: 'pointer' }}>
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedTransactionIds.includes(tx._id)} onChange={(e) => { e.stopPropagation(); toggleTransactionSelection(tx._id) }} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td style={{ padding: '0.65rem' }}>{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ padding: '0.65rem', textTransform: 'capitalize', fontWeight: '700' }}>{TRANSACTION_TYPE_LABELS[tx.type] || tx.type}</td>
                    <td style={{ padding: '0.65rem' }}>{getTransactionPartyLabel(tx)}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>{tx.currency} {Number(tx.amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.65rem', textTransform: 'capitalize', fontWeight: '600' }}><span style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', ...(TRANSACTION_STATUS_STYLES[tx.status] || { background: '#E5E7EB', color: C.ink }) }}>{tx.status}</span></td>
                    <td style={{ padding: '0.65rem', maxWidth: '260px', color: C.inkSoft }}>{getTransactionDescription(tx)}</td>
                    <td style={{ padding: '0.65rem' }}>
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        {(tx.attachments || []).length ? (
                          <a href={resolveTransactionAttachmentUrl(tx.attachments[0])} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#1D4ED8', fontWeight: '700', textDecoration: 'none' }}>{getTransactionAttachmentLabel(tx)}</a>
                        ) : (
                          <span style={{ color: C.inkSoft }}>{getTransactionAttachmentLabel(tx)}</span>
                        )}
                        <label onClick={(e) => e.stopPropagation()} style={{ width: 'fit-content', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', border: '1px solid #7DD3FC', background: '#E0F2FE', color: '#075985', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.74rem', fontWeight: '700' }}>
                          Upload
                          <input type="file" disabled={saving} onChange={(e) => handleUploadTransactionAttachment(e.target.files?.[0], tx._id)} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {tx.status !== 'posted' && <button onClick={(e) => { e.stopPropagation(); populateTransactionForm(tx) }} style={{ padding: '0.3rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.3rem', background: '#fff', color: C.ink, cursor: 'pointer' }}>Edit</button>}
                        {['draft', 'returned', 'rejected'].includes(tx.status) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('submit', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#F59E0B', color: '#111827', cursor: 'pointer' }}>Submit</button>}
                        {tx.status === 'submitted' && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('approve', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#0EA5E9', color: '#fff', cursor: 'pointer' }}>Approve</button>}
                        {['submitted', 'approved'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('return', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FBCFE8', color: '#9D174D', cursor: 'pointer' }}>Return</button>}
                        {['submitted', 'approved', 'returned'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('reject', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer' }}>Reject</button>}
                        {['submitted', 'approved'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('post', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: C.s1, color: '#fff', cursor: 'pointer' }}>Post</button>}
                        {tx.status !== 'posted' && <button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer' }}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!transactions.length && (
                  <tr>
                    <td colSpan={9} style={{ padding: '1rem', textAlign: 'center', color: C.inkSoft }}>No transactions match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>Showing {Number(transactions.length || 0).toLocaleString()} entries · {Number(transactionMeta.total || 0).toLocaleString()} total transactions</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={!transactionMeta.cursorHistory?.length || loading}
                onClick={() => {
                  const history = Array.isArray(transactionMeta.cursorHistory) ? [...transactionMeta.cursorHistory] : []
                  const previousCursor = history.pop() || null
                  loadTransactions({ cursor: previousCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!transactionMeta.hasMore || !transactionMeta.nextCursor || loading}
                onClick={() => {
                  const history = [...(transactionMeta.cursorHistory || []), transactionMeta.cursor || null]
                  loadTransactions({ cursor: transactionMeta.nextCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
