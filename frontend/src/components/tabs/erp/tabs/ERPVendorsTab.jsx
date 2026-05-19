import { API_ORIGIN } from '../../../../api/client'

export default function ERPVendorsTab({
  activeTab,
  C,
  modalInputStyle,
  emptyCardStyle,
  saving,
  canManageVendors,
  vendorSummary,
  vendorPaymentCalendar,
  vendorComplianceSummary,
  vendorOverdueQueue,
  vendorFilters,
  showVendorForm,
  editingVendorId,
  vendorForm,
  vendors,
  selectedVendorId,
  selectedVendorDetails,
  vendorPermissions,
  vendorWorkflowReason,
  vendorDocumentForm,
  handleVendorFilterSearch,
  setEditingVendorId,
  setShowVendorForm,
  loadVendorOverdueQueue,
  setVendorFilters,
  handleCreateVendor,
  setVendorForm,
  handleVendorSelect,
  handleEditVendor,
  handleDeleteVendor,
  setVendorWorkflowReason,
  handleVendorWorkflowStatus,
  handleAddVendorDocument,
  setVendorDocumentForm,
  handleDeleteVendorDocument,
}) {
  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
  }

  const getVendorContact = (vendor) => {
    const parts = [vendor.contactPerson, vendor.phone, vendor.email].filter(Boolean)
    return parts.length ? parts.join(' | ') : '-'
  }

  const getVendorDueSummary = (vendor) => {
    const nextDue = vendor.nextDue || null
    const overdue = Number(vendor.dueAlerts?.overdue || 0)
    const amount = Number(vendor.dueAmount || nextDue?.remaining || 0)
    if (!nextDue && !amount) return { label: 'No due', color: C.inkSoft, detail: '-' }
    if (overdue > 0 || nextDue?.alertLevel === 'overdue') {
      return { label: `${amount.toLocaleString()} overdue`, color: '#991B1B', detail: nextDue ? `Since ${formatDate(nextDue.dueDate)}` : `${overdue} overdue` }
    }
    return { label: `${amount.toLocaleString()} due`, color: '#92400E', detail: nextDue ? `Next ${formatDate(nextDue.dueDate)}` : '-' }
  }

  const getVendorAlertText = (vendor) => {
    const nextDue = vendor.nextDue
    if (nextDue?.alertLevel === 'overdue') return `Overdue payment: ${Number(nextDue.remaining || 0).toLocaleString()} ${nextDue.currency || vendor.currency || 'USD'}`
    if (nextDue?.alertLevel === 'due_soon') return `Due soon: ${Number(nextDue.remaining || 0).toLocaleString()} ${nextDue.currency || vendor.currency || 'USD'}`
    if (vendor.compliance && !vendor.compliance.compliant) return `Missing docs: ${(vendor.compliance.missingDocuments || []).join(', ') || 'review required'}`
    return 'Monthly review'
  }

  const getVendorMessage = (vendor) => {
    if (vendor.nextDue) return `${getVendorAlertText(vendor)}. Contact ${vendor.contactPerson || vendor.email || vendor.phone || 'vendor'} before ${formatDate(vendor.nextDue.dueDate)}.`
    if (vendor.notes) return vendor.notes
    return 'No open payment message.'
  }

  const getVendorDocumentUrl = (doc, vendorId = selectedVendorId) => {
    if (!doc) return ''
    if (doc.fileName && doc._id && vendorId) return `${API_ORIGIN}/api/erp-accounting/vendors/${vendorId}/documents/${doc._id}/download`
    return doc.fileUrl || ''
  }

  return (
    <>
      {/* VENDORS TAB */}
      {activeTab === 'vendors' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Vendors Management</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleVendorFilterSearch}
                style={{ padding: '0.5rem 0.85rem', background: '#E0F2FE', color: '#075985', border: '1px solid #7DD3FC', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Refresh List
              </button>
              <button
                onClick={() => {
                  setEditingVendorId('')
                  setShowVendorForm((prev) => !prev)
                }}
                disabled={!canManageVendors}
                style={{ padding: '0.5rem 0.85rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: canManageVendors ? 'pointer' : 'not-allowed', opacity: canManageVendors ? 1 : 0.55, fontWeight: '600' }}
              >
                + Add Vendor
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #059669', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Total Vendors</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.totalVendors}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #0284C7', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Total Outstanding</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{Number(vendorSummary.totalOutstanding || 0).toLocaleString()}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #D97706', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Over Limit</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.overLimit}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #DC2626', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Blacklisted</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.blacklisted}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #8B5CF6', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>In Review</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.review || 0}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #D97706', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Non-Compliant</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.nonCompliant || 0}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#991B1B', fontSize: '0.76rem' }}>Overdue Dues</p>
              <p style={{ margin: '0.2rem 0 0', color: '#7F1D1D', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.overdue || 0}</p>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.76rem' }}>Due Soon (7d)</p>
              <p style={{ margin: '0.2rem 0 0', color: '#78350F', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.due_soon || 0}</p>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.76rem' }}>Upcoming</p>
              <p style={{ margin: '0.2rem 0 0', color: '#1E3A8A', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.upcoming || 0}</p>
            </div>
            <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.76rem' }}>Total Due Amount</p>
              <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{Number(vendorPaymentCalendar.alerts?.totalDue || 0).toLocaleString()}</p>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.76rem' }}>Doc Warning 30d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#1E3A8A', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning30 || 0}</p>
            </div>
            <div style={{ background: '#EEF2FF', border: '1px solid #A5B4FC', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#3730A3', fontSize: '0.76rem' }}>Doc Warning 60d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#312E81', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning60 || 0}</p>
            </div>
            <div style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#5B21B6', fontSize: '0.76rem' }}>Doc Warning 90d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#4C1D95', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning90 || 0}</p>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#991B1B', fontSize: '0.76rem' }}>Doc Expired</p>
              <p style={{ margin: '0.2rem 0 0', color: '#7F1D1D', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.expired || 0}</p>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.76rem' }}>Overdue Queue</p>
              <p style={{ margin: '0.2rem 0 0', color: '#78350F', fontWeight: '700' }}>{vendorOverdueQueue.summary?.total || 0} alerts</p>
            </div>
          </div>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
              <p style={{ margin: 0, color: C.ink, fontWeight: '700', fontSize: '0.9rem' }}>Overdue Email Queue Payload</p>
              <button onClick={loadVendorOverdueQueue} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #7DD3FC', background: '#E0F2FE', color: '#075985', cursor: 'pointer', fontSize: '0.74rem', fontWeight: '600' }}>Refresh Queue</button>
            </div>
            <p style={{ margin: '0 0 0.4rem', color: C.inkSoft, fontSize: '0.78rem' }}>
              Total: {vendorOverdueQueue.summary?.total || 0} | With Recipient: {vendorOverdueQueue.summary?.withRecipient || 0} | Critical: {vendorOverdueQueue.summary?.critical || 0} | Amount Due: {Number(vendorOverdueQueue.summary?.totalAmountDue || 0).toLocaleString()}
            </p>
            <div style={{ maxHeight: '130px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
              {(vendorOverdueQueue.queue || []).slice(0, 12).map((row) => (
                <div key={row.queueId} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: C.ink }}>{row.subject}</span>
                    <span style={{ fontSize: '0.7rem', color: row.priority === 'high' ? '#991B1B' : '#92400E', fontWeight: '700' }}>{row.priority}</span>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: C.inkSoft, marginTop: '0.15rem' }}>To: {(row.to || []).join(', ') || 'No recipient email'}</div>
                  <div style={{ fontSize: '0.71rem', color: C.inkSoft, marginTop: '0.1rem' }}>{row.preview}</div>
                </div>
              ))}
              {(!vendorOverdueQueue.queue || !vendorOverdueQueue.queue.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No overdue queue payloads right now.</p>}
            </div>
          </div>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <input
                placeholder="Search name, code, contact, phone"
                value={vendorFilters.search}
                onChange={(e) => setVendorFilters((prev) => ({ ...prev, search: e.target.value }))}
                style={modalInputStyle}
              />
              <select value={vendorFilters.status} onChange={(e) => setVendorFilters((prev) => ({ ...prev, status: e.target.value }))} style={modalInputStyle}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
              <select value={vendorFilters.approvalStatus} onChange={(e) => setVendorFilters((prev) => ({ ...prev, approvalStatus: e.target.value }))} style={modalInputStyle}>
                <option value="">All Workflow</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
              <select value={vendorFilters.riskLevel} onChange={(e) => setVendorFilters((prev) => ({ ...prev, riskLevel: e.target.value }))} style={modalInputStyle}>
                <option value="">All Risk</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                placeholder="Category"
                value={vendorFilters.category}
                onChange={(e) => setVendorFilters((prev) => ({ ...prev, category: e.target.value }))}
                style={modalInputStyle}
              />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              <input type="checkbox" checked={vendorFilters.includeInactive} onChange={(e) => setVendorFilters((prev) => ({ ...prev, includeInactive: e.target.checked }))} />
              Include inactive vendors
            </label>
          </div>

          {showVendorForm && (
            <form onSubmit={handleCreateVendor} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ marginTop: 0, marginBottom: '0.6rem', color: C.ink, fontWeight: '700' }}>{editingVendorId ? 'Update Vendor Profile' : 'Create Vendor Profile'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
                <input placeholder="Vendor Code" value={vendorForm.vendorCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, vendorCode: e.target.value.toUpperCase() }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Vendor Name" value={vendorForm.name} onChange={(e) => setVendorForm((prev) => ({ ...prev, name: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Contact Person" value={vendorForm.contactPerson} onChange={(e) => setVendorForm((prev) => ({ ...prev, contactPerson: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Phone" value={vendorForm.phone} onChange={(e) => setVendorForm((prev) => ({ ...prev, phone: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Email" value={vendorForm.email} onChange={(e) => setVendorForm((prev) => ({ ...prev, email: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Address" value={vendorForm.address} onChange={(e) => setVendorForm((prev) => ({ ...prev, address: e.target.value }))} style={modalInputStyle} />
                <input placeholder="City" value={vendorForm.city} onChange={(e) => setVendorForm((prev) => ({ ...prev, city: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Country" value={vendorForm.country} onChange={(e) => setVendorForm((prev) => ({ ...prev, country: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Postal Code" value={vendorForm.postalCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, postalCode: e.target.value }))} style={modalInputStyle} />
                <input placeholder="GST/VAT" value={vendorForm.gstVat} onChange={(e) => setVendorForm((prev) => ({ ...prev, gstVat: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Tax Registration" value={vendorForm.taxRegistrationNo} onChange={(e) => setVendorForm((prev) => ({ ...prev, taxRegistrationNo: e.target.value }))} style={modalInputStyle} />
                <input type="number" step="0.01" placeholder="Opening Balance" value={vendorForm.openingBalance} onChange={(e) => setVendorForm((prev) => ({ ...prev, openingBalance: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input type="number" placeholder="Payment Terms (days)" value={vendorForm.paymentTermsDays} onChange={(e) => setVendorForm((prev) => ({ ...prev, paymentTermsDays: e.target.value }))} style={modalInputStyle} />
                <input type="number" step="0.01" placeholder="Credit Limit" value={vendorForm.creditLimit} onChange={(e) => setVendorForm((prev) => ({ ...prev, creditLimit: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Category" value={vendorForm.category} onChange={(e) => setVendorForm((prev) => ({ ...prev, category: e.target.value }))} style={modalInputStyle} />
                <select value={vendorForm.rating} onChange={(e) => setVendorForm((prev) => ({ ...prev, rating: e.target.value }))} style={modalInputStyle}>
                  <option value="1">1 Star</option>
                  <option value="2">2 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="5">5 Stars</option>
                </select>
                <select value={vendorForm.riskLevel} onChange={(e) => setVendorForm((prev) => ({ ...prev, riskLevel: e.target.value }))} style={modalInputStyle}>
                  <option value="low">Risk Low</option>
                  <option value="medium">Risk Medium</option>
                  <option value="high">Risk High</option>
                </select>
                <select value={vendorForm.status} onChange={(e) => setVendorForm((prev) => ({ ...prev, status: e.target.value }))} style={modalInputStyle}>
                  <option value="active">Status Active</option>
                  <option value="on_hold">Status On Hold</option>
                  <option value="blacklisted">Status Blacklisted</option>
                </select>
                <input placeholder="Preferred Currency" value={vendorForm.preferredCurrency} onChange={(e) => setVendorForm((prev) => ({ ...prev, preferredCurrency: e.target.value.toUpperCase() }))} style={modalInputStyle} />
                <input placeholder="Base Currency" value={vendorForm.currency} onChange={(e) => setVendorForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Bank Name" value={vendorForm.bankName} onChange={(e) => setVendorForm((prev) => ({ ...prev, bankName: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Bank Account Number" value={vendorForm.bankAccountNumber} onChange={(e) => setVendorForm((prev) => ({ ...prev, bankAccountNumber: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="IBAN" value={vendorForm.iban} onChange={(e) => setVendorForm((prev) => ({ ...prev, iban: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="SWIFT" value={vendorForm.swiftCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, swiftCode: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Tags (comma separated)" value={vendorForm.tags} onChange={(e) => setVendorForm((prev) => ({ ...prev, tags: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Notes" value={vendorForm.notes} onChange={(e) => setVendorForm((prev) => ({ ...prev, notes: e.target.value }))} style={modalInputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving || (!canManageVendors && !editingVendorId)} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' }}>{saving ? 'Saving...' : editingVendorId ? 'Update Vendor' : 'Create Vendor'}</button>
                <button type="button" onClick={() => { setShowVendorForm(false); setEditingVendorId('') }} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1rem' }}>
            <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Code</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Vendor</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Contact</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Pay Due / Overdue</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Next Due Date</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Alert</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Attachments</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Message</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => {
                    const due = getVendorDueSummary(v)
                    const latestDoc = (v.documents || [])[0]
                    return (
                    <tr key={v._id} style={{ borderBottom: `1px solid ${C.p2}`, background: selectedVendorId === v._id ? '#ECFEFF' : 'transparent' }}>
                      <td style={{ padding: '0.6rem' }}>{v.vendorCode || '-'}</td>
                      <td style={{ padding: '0.6rem', minWidth: '170px' }}>
                        <div style={{ fontWeight: '700', color: C.ink }}>{v.name}</div>
                        <div style={{ color: C.inkSoft, fontSize: '0.74rem' }}>{v.category || 'general'} | Risk {v.riskLevel || 'medium'}</div>
                      </td>
                      <td style={{ padding: '0.6rem', minWidth: '170px' }}>{getVendorContact(v)}</td>
                      <td style={{ padding: '0.6rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: v.status === 'blacklisted' ? '#FEE2E2' : v.status === 'on_hold' ? '#FEF3C7' : '#DCFCE7', color: v.status === 'blacklisted' ? '#991B1B' : v.status === 'on_hold' ? '#92400E' : '#166534', fontWeight: '700', fontSize: '0.72rem' }}>{v.status || 'active'}</span>
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '700', color: v.isOverLimit ? '#DC2626' : C.ink }}>{Number(v.outstanding || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.6rem', minWidth: '140px' }}>
                        <div style={{ color: due.color, fontWeight: '800' }}>{due.label}</div>
                        <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{due.detail}</div>
                      </td>
                      <td style={{ padding: '0.6rem' }}>{formatDate(v.nextDue?.dueDate)}</td>
                      <td style={{ padding: '0.6rem', minWidth: '150px', color: C.inkSoft }}>{getVendorAlertText(v)}</td>
                      <td style={{ padding: '0.6rem' }}>
                        {latestDoc ? (
                          <a href={getVendorDocumentUrl(latestDoc, v._id)} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontWeight: '700', textDecoration: 'none' }}>
                            {(v.documents || []).length} file{(v.documents || []).length === 1 ? '' : 's'}
                          </a>
                        ) : (
                          <span style={{ color: C.inkSoft }}>No file</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem', minWidth: '220px', color: C.inkSoft }}>{getVendorMessage(v)}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleVendorSelect(v._id)} style={{ padding: '0.25rem 0.55rem', background: '#E0F2FE', border: '1px solid #7DD3FC', borderRadius: '0.3rem', color: '#075985', cursor: 'pointer', fontSize: '0.75rem' }}>View</button>
                          {vendorPermissions.canUpdateOperational && <button onClick={() => handleEditVendor(v)} style={{ padding: '0.25rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>}
                          {vendorPermissions.canManage && <button onClick={() => handleDeleteVendor(v)} style={{ padding: '0.25rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.75rem' }}>Deactivate</button>}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {vendors.length === 0 && <p style={{ color: C.inkSoft, margin: '0.8rem', textAlign: 'center' }}>No vendors found for current filters.</p>}
            </div>

            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.6rem', color: C.ink, fontWeight: '700' }}>Vendor Details</h4>
              {!selectedVendorDetails?.vendor ? (
                <div style={emptyCardStyle}>Select a vendor to view profile, financial metrics, and recent activity.</div>
              ) : (
                <div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>{selectedVendorDetails.vendor.name}</p>
                    <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>{selectedVendorDetails.vendor.vendorCode || '-'} | {selectedVendorDetails.vendor.contactPerson || 'No contact'} | {selectedVendorDetails.vendor.phone || '-'}</p>
                  </div>

                  <div style={{ marginBottom: '0.8rem', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem', background: '#F8FAFC' }}>
                    <p style={{ margin: '0 0 0.4rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Approval Workflow</p>
                    <p style={{ margin: '0 0 0.35rem', color: C.inkSoft, fontSize: '0.76rem' }}>Current: <span style={{ fontWeight: '700', color: C.ink }}>{selectedVendorDetails.vendor.approvalStatus || 'draft'}</span></p>
                    <input
                      placeholder="Reason for transition"
                      value={vendorWorkflowReason}
                      onChange={(e) => setVendorWorkflowReason(e.target.value)}
                      style={{ ...modalInputStyle, marginBottom: '0.45rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button onClick={() => handleVendorWorkflowStatus('draft')} disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.74rem' }}>Draft</button>
                      <button onClick={() => handleVendorWorkflowStatus('review')} disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontSize: '0.74rem' }}>Review</button>
                      <button onClick={() => handleVendorWorkflowStatus('approved')} disabled={saving || !vendorPermissions.canManage} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontSize: '0.74rem' }}>Approve</button>
                      <button onClick={() => handleVendorWorkflowStatus('blacklisted')} disabled={saving || !vendorPermissions.canManage} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontSize: '0.74rem' }}>Blacklist</button>
                    </div>
                    <div style={{ marginTop: '0.45rem', maxHeight: '84px', overflowY: 'auto', borderTop: `1px solid ${C.p2}`, paddingTop: '0.45rem' }}>
                      {(selectedVendorDetails.vendor.approvalHistory || []).slice().reverse().slice(0, 5).map((h, idx) => (
                        <p key={`${h.changedAt || idx}-${idx}`} style={{ margin: '0 0 0.3rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                          <strong style={{ color: C.ink }}>{h.status}</strong> {h.reason ? `- ${h.reason}` : ''} ({new Date(h.changedAt).toLocaleString()})
                        </p>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.8rem', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem', background: '#F8FAFC' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Required Document Compliance</p>
                    <p style={{ margin: '0 0 0.35rem', color: C.inkSoft, fontSize: '0.76rem' }}>
                      Category: <strong style={{ color: C.ink }}>{selectedVendorDetails.vendor.compliance?.category || selectedVendorDetails.vendor.category || 'general'}</strong>
                      {' | '}
                      Score: <strong style={{ color: C.ink }}>{Number(selectedVendorDetails.vendor.compliance?.complianceScore || 0).toLocaleString()}%</strong>
                      {' | '}
                      Status: <strong style={{ color: selectedVendorDetails.vendor.compliance?.compliant ? '#065F46' : '#991B1B' }}>{selectedVendorDetails.vendor.compliance?.compliant ? 'Compliant' : 'At Risk'}</strong>
                    </p>
                    <p style={{ margin: '0 0 0.25rem', color: C.inkSoft, fontSize: '0.74rem' }}>
                      Missing Required: {(selectedVendorDetails.vendor.compliance?.missingDocuments || []).join(', ') || 'None'}
                    </p>
                    <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.74rem' }}>
                      Expired Required: {(selectedVendorDetails.vendor.compliance?.expiredRequiredDocuments || []).join(', ') || 'None'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Outstanding</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{Number(selectedVendorDetails.vendor.outstanding || 0).toLocaleString()}</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Credit Utilization</p>
                      <p style={{ margin: '0.2rem 0 0', color: selectedVendorDetails.vendor.isOverLimit ? '#DC2626' : C.ink, fontWeight: '700' }}>{Number(selectedVendorDetails.vendor.utilizationPercent || 0).toLocaleString()}%</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Posted Purchases</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{selectedVendorDetails.vendor.purchaseCount || 0}</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Posted Payments</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{selectedVendorDetails.vendor.paymentCount || 0}</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.6rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Recent Transactions</p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.recentTransactions || []).map((tx) => (
                        <div key={tx._id} style={{ padding: '0.5rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.77rem', textTransform: 'capitalize' }}>{tx.type} ({tx.status})</span>
                            <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.77rem' }}>{Number(tx.amount || 0).toLocaleString()} {tx.currency || 'USD'}</span>
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{new Date(tx.date).toLocaleString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.recentTransactions || !selectedVendorDetails.recentTransactions.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No recent transactions.</p>}
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Recent Ledger Activity</p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.recentLedgerEntries || []).map((entry) => (
                        <div key={entry._id} style={{ padding: '0.5rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.77rem', textTransform: 'capitalize' }}>{entry.referenceType}</span>
                            <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.77rem' }}>{Number(entry.amount || 0).toLocaleString()} {entry.currency || 'USD'}</span>
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{new Date(entry.date).toLocaleString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.recentLedgerEntries || !selectedVendorDetails.recentLedgerEntries.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No recent ledger activity.</p>}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Document Vault</p>
                    <form onSubmit={handleAddVendorDocument} style={{ border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.5rem', marginBottom: '0.45rem', background: '#F8FAFC' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                        <select value={vendorDocumentForm.docType} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, docType: e.target.value }))} style={modalInputStyle}>
                          <option value="contract">Contract</option>
                          <option value="trade_license">Trade License</option>
                          <option value="vat_certificate">VAT Certificate</option>
                          <option value="bank_proof">Bank Proof</option>
                          <option value="other">Other</option>
                        </select>
                        <input placeholder="Title" value={vendorDocumentForm.title} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, title: e.target.value }))} style={modalInputStyle} />
                        <input placeholder="Document No" value={vendorDocumentForm.documentNo} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, documentNo: e.target.value }))} style={modalInputStyle} />
                        <input placeholder="File URL (optional)" value={vendorDocumentForm.fileUrl} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, fileUrl: e.target.value }))} style={modalInputStyle} />
                        <label style={{ ...modalInputStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', color: C.inkSoft }}>
                          <span>{vendorDocumentForm.file?.name || 'Upload PDF/image/file'}</span>
                          <input type="file" onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, file: e.target.files?.[0] || null, title: prev.title || e.target.files?.[0]?.name || '' }))} style={{ display: 'none' }} />
                        </label>
                        <input type="date" value={vendorDocumentForm.issueDate} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, issueDate: e.target.value }))} style={modalInputStyle} />
                        <input type="date" value={vendorDocumentForm.expiryDate} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, expiryDate: e.target.value }))} style={modalInputStyle} />
                      </div>
                      <button type="submit" disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.32rem', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontSize: '0.74rem' }}>Add Document</button>
                    </form>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.vendor.documents || []).map((doc) => (
                        <div key={doc._id} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                            {getVendorDocumentUrl(doc) ? (
                              <a href={getVendorDocumentUrl(doc)} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontWeight: '700', fontSize: '0.74rem', textDecoration: 'none' }}>{doc.docType} - {doc.title}</a>
                            ) : (
                              <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.74rem' }}>{doc.docType} - {doc.title}</span>
                            )}
                            {vendorPermissions.canUpdateOperational && <button onClick={() => handleDeleteVendorDocument(doc._id)} style={{ padding: '0.2rem 0.45rem', borderRadius: '0.28rem', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontSize: '0.7rem' }}>Delete</button>}
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.71rem' }}>{doc.documentNo || '-'} {doc.expiryDate ? `| Exp: ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.vendor.documents || !selectedVendorDetails.vendor.documents.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No documents uploaded.</p>}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Payment Calendar & Due Alerts</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))', gap: '0.35rem', marginBottom: '0.45rem' }}>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#FEF2F2' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Overdue</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#991B1B', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.overdue || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#FFFBEB' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Due Soon</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#92400E', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.due_soon || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#EFF6FF' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Upcoming</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#1D4ED8', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.upcoming || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#F8FAFC' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Later</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: C.ink, fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.later || 0}</p></div>
                    </div>
                    <div style={{ maxHeight: '130px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.paymentCalendar || []).map((due) => (
                        <div key={`${due.purchaseTransactionId}-${due.dueDate}`} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: '600', color: C.ink }}>{Number(due.remaining || 0).toLocaleString()} {due.currency || 'USD'}</span>
                            <span style={{ fontSize: '0.71rem', color: due.alertLevel === 'overdue' ? '#991B1B' : due.alertLevel === 'due_soon' ? '#92400E' : C.inkSoft }}>{due.alertLevel} ({due.daysToDue}d)</span>
                          </div>
                          <div style={{ fontSize: '0.71rem', color: C.inkSoft }}>Due {new Date(due.dueDate).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.paymentCalendar || !selectedVendorDetails.paymentCalendar.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No pending due amounts in horizon.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
