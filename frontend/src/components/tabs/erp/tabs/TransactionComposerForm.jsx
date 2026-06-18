export default function TransactionComposerForm({
  C,
  modalInputStyle,
  handleCreateTransaction,
  isTransactionEditMode,
  resetTransactionComposer,
  transactionForm,
  setTransactionForm,
  availableTransactionTypes,
  TRANSACTION_TYPE_LABELS,
  currencies,
  customers,
  vendors,
  inventoryProducts,
  mappings,
  accounts,
  saving,
}) {
  return (
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
        {['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(String(transactionForm.type || '').toLowerCase()) && (
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
  )
}
