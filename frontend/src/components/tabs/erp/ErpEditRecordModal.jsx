import { ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from './erpTabPresentation'

export default function ErpEditRecordModal({
  editState,
  setEditState,
  accounts,
  ledgerDepartments,
  erpBaseCurrencyCode,
  saving,
  onClose,
  onSubmit,
  colors,
}) {
  if (!editState.record) return null
  const C = colors
  return (
    <div style={ERP_MODAL_BACKDROP_STYLE} onClick={onClose}>
      <div style={ERP_MODAL_CARD_STYLE} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: C.ink, fontSize: '1.1rem', fontWeight: '700' }}>
          Edit {editState.type.charAt(0).toUpperCase() + editState.type.slice(1)}
        </h3>
        <form onSubmit={onSubmit}>
          {editState.type === 'account' && (
            <>
              <input value={editState.form.accountName || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, accountName: e.target.value } }))} placeholder="Account Name" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.description || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))} placeholder="Description" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.department || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))} placeholder="Department" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.currency || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value } }))} placeholder="Currency" style={ERP_MODAL_INPUT_STYLE} />
            </>
          )}
          {editState.type === 'mapping' && (
            <>
              <input value={editState.form.mappingType || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, mappingType: e.target.value } }))} placeholder="Mapping Type" style={ERP_MODAL_INPUT_STYLE} />
              <select value={editState.form.debitAccountId || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="">Select Debit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select value={editState.form.creditAccountId || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="">Select Credit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select value={editState.form.department || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="">Shared / All Departments</option>
                {ledgerDepartments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <input value={editState.form.description || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))} placeholder="Description" style={ERP_MODAL_INPUT_STYLE} />
            </>
          )}
          {editState.type === 'currency' && (
            <>
              <input value={editState.form.code || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, code: e.target.value.toUpperCase() } }))} placeholder="Code" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.name || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))} placeholder="Name" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.symbol || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, symbol: e.target.value } }))} placeholder="Symbol" style={ERP_MODAL_INPUT_STYLE} />
              <input type="number" step="0.0001" value={editState.form.exchangeRate || 1} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, exchangeRate: e.target.value } }))} placeholder="Exchange Rate" style={ERP_MODAL_INPUT_STYLE} disabled={Boolean(editState.form.baseCurrency)} />
              {!editState.form.baseCurrency && (
                <input type="number" step="0.0001" min="0" value={editState.form.oneUsdEquals ?? ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, oneUsdEquals: e.target.value } }))} placeholder={`1 ${erpBaseCurrencyCode} = (units of this currency)`} style={ERP_MODAL_INPUT_STYLE} />
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={Boolean(editState.form.baseCurrency)} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, baseCurrency: e.target.checked, exchangeRate: e.target.checked ? 1 : prev.form.exchangeRate } }))} />
                Base currency
              </label>
            </>
          )}
          {editState.type === 'customer' && (
            <>
              <input value={editState.form.name || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))} placeholder="Name" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.phone || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))} placeholder="Phone" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.email || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, email: e.target.value } }))} placeholder="Email" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.address || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, address: e.target.value } }))} placeholder="Address" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.gstVat || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, gstVat: e.target.value } }))} placeholder="GST/VAT" style={ERP_MODAL_INPUT_STYLE} />
              <input type="number" value={editState.form.creditLimit || 0} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditLimit: e.target.value } }))} placeholder="Credit Limit" style={ERP_MODAL_INPUT_STYLE} />
              <input type="number" value={editState.form.paymentTermsDays || 0} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, paymentTermsDays: e.target.value } }))} placeholder="Payment Terms (days)" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.currency || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value } }))} placeholder="Currency" style={ERP_MODAL_INPUT_STYLE} />
              <textarea value={editState.form.notes || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, notes: e.target.value } }))} placeholder="Notes" style={{ ...ERP_MODAL_INPUT_STYLE, minHeight: '72px' }} />
            </>
          )}
          {editState.type === 'ledger' && (
            <>
              <input type="date" value={editState.form.date || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, date: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE} />
              <select value={editState.form.debitAccountId || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="">Debit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select value={editState.form.creditAccountId || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="">Credit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <input type="number" step="0.01" value={editState.form.amount || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, amount: e.target.value } }))} placeholder="Amount" style={ERP_MODAL_INPUT_STYLE} />
              <input value={editState.form.description || ''} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))} placeholder="Description" style={ERP_MODAL_INPUT_STYLE} />
              <select value={editState.form.referenceType || 'journal'} onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, referenceType: e.target.value } }))} style={ERP_MODAL_INPUT_STYLE}>
                <option value="journal">Journal</option>
                <option value="invoice">Invoice</option>
                <option value="payment">Payment</option>
                <option value="purchase">Purchase</option>
                <option value="expense">Expense</option>
                <option value="payroll">Payroll</option>
              </select>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '0.6rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
