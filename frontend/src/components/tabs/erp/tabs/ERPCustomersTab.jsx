export default function ERPCustomersTab({
  C,
  canManageCustomers,
  showCustomerForm,
  setShowCustomerForm,
  customerForm,
  setCustomerForm,
  handleCreateCustomer,
  saving,
  customers,
  handleEditCustomer,
  handleDeleteCustomer,
}) {
  return (
    <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customers</h3>
                {canManageCustomers && (
                  <button
                    onClick={() => setShowCustomerForm(!showCustomerForm)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: C.s1,
                      color: C.t1,
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    + Add Customer
                  </button>
                )}
              </div>
              {showCustomerForm && (
                <form onSubmit={handleCreateCustomer} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <input placeholder="Customer Name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="GST/VAT" value={customerForm.gstVat} onChange={(e) => setCustomerForm({ ...customerForm, gstVat: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input type="number" step="0.01" placeholder="Opening Balance" value={customerForm.openingBalance} onChange={(e) => setCustomerForm({ ...customerForm, openingBalance: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input type="number" step="0.01" placeholder="Credit Limit" value={customerForm.creditLimit} onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input type="number" placeholder="Payment Terms (Days)" value={customerForm.paymentTermsDays} onChange={(e) => setCustomerForm({ ...customerForm, paymentTermsDays: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="Currency (e.g. USD)" value={customerForm.currency} onChange={(e) => setCustomerForm({ ...customerForm, currency: e.target.value.toUpperCase() })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <input placeholder="Notes" value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.75rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
                  <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                    {saving ? 'Saving...' : 'Create Customer'}
                  </button>
                  <button type="button" onClick={() => setShowCustomerForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </form>
              )}
              <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Phone</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Email</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>GST/VAT</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Opening</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Outstanding</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>0-30</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>31-60</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>61-90</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>90+</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debtor A/C</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{customer.name}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.phone || '-'}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.email || '-'}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.gstVat || '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.openingBalance || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.outstandingBalance || 0) > 0 ? C.s1 : Number(customer.outstandingBalance || 0) < 0 ? '#DC2626' : C.t2, fontWeight: '600' }}>{Number(customer.outstandingBalance || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket0to30 || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket31to60 || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket61to90 || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.aging?.bucket90Plus || 0) > 0 ? '#F59E0B' : C.t2, fontWeight: Number(customer.aging?.bucket90Plus || 0) > 0 ? '700' : '400' }}>{Number(customer.aging?.bucket90Plus || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.ledgerAccountId?.accountCode || '-'}{customer.ledgerAccountId?.accountName ? ` - ${customer.ledgerAccountId.accountName}` : ''}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => handleEditCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDeleteCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {customers.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers added yet.</p>}
            </div>
  )
}
