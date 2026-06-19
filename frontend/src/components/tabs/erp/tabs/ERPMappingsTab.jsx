import erpAccountingAPI from '../../../../api/erp-accounting'
import { filterActiveAccounts } from '../accountDropdownHelpers'

export default function ERPMappingsTab({
  C,
  canManageAccounts,
  showMappingForm,
  setShowMappingForm,
  mappingFilters,
  setMappingFilters,
  LEDGER_DEPARTMENTS,
  mappingSummary,
  getDepartmentBadgeStyle,
  mappingForm,
  setMappingForm,
  accounts,
  handleCreateMapping,
  saving,
  mappings,
  sorting,
  setSorting,
  pagination,
  setPagination,
  ITEMS_PER_PAGE,
  token,
  loadMappings,
  showNotification,
  setError,
  setTestMapping,
  setShowMappingTest,
  handleEditMapping,
  handleDeleteMapping,
}) {
  const activeAccounts = filterActiveAccounts(accounts)
  return (
    <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Mappings</h3>
                {canManageAccounts && (
                  <button
                    onClick={() => setShowMappingForm(!showMappingForm)}
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
                    + Add Mapping
                  </button>
                )}
              </div>
              <p style={{ color: C.inkSoft, marginBottom: '1rem', fontSize: '0.875rem' }}>
                📌 Auto-map accounts for transactions. When a user selects a transaction type, the system auto-fills debit and credit accounts.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <select
                  value={mappingFilters.department}
                  onChange={(e) => setMappingFilters((prev) => ({ ...prev, department: e.target.value }))}
                  style={{ display: 'block', width: '100%', padding: '0.6rem 0.75rem', background: '#F9FAFB', border: '1px solid #D1D5DB', color: C.ink, borderRadius: '0.5rem' }}
                >
                  <option value="">All departments</option>
                  {LEDGER_DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
                <div style={{ color: C.inkSoft, fontSize: '0.82rem', fontWeight: '700' }}>Filter scoped mappings by department</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#EEF2FF', color: '#3730A3', fontSize: '0.76rem', fontWeight: '700' }}>Total: {Number(mappingSummary.total || 0).toLocaleString()}</span>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#F3F4F6', color: '#374151', fontSize: '0.76rem', fontWeight: '700' }}>Shared: {Number(mappingSummary.shared || 0).toLocaleString()}</span>
                {Object.entries(mappingSummary.byDepartment || {})
                  .sort((left, right) => {
                    const countDifference = Number(right[1] || 0) - Number(left[1] || 0)
                    if (countDifference !== 0) return countDifference
                    return String(left[0] || '').localeCompare(String(right[0] || ''))
                  })
                  .map(([department, count]) => (
                  <span key={department} style={{ ...getDepartmentBadgeStyle(department), padding: '0.3rem 0.55rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', textTransform: 'capitalize' }}>
                    {department}: {Number(count || 0).toLocaleString()}
                  </span>
                ))}
              </div>
              {showMappingForm && (
                <form onSubmit={handleCreateMapping} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    placeholder="Mapping Type"
                    value={mappingForm.mappingType}
                    onChange={(e) => setMappingForm({ ...mappingForm, mappingType: e.target.value })}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
                  />
                  <select
                    value={mappingForm.debitAccountId}
                    onChange={(e) => setMappingForm({ ...mappingForm, debitAccountId: e.target.value })}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
                  >
                    <option value="">Select Debit Account</option>
                    {activeAccounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={mappingForm.creditAccountId}
                    onChange={(e) => setMappingForm({ ...mappingForm, creditAccountId: e.target.value })}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
                  >
                    <option value="">Select Credit Account</option>
                    {activeAccounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={mappingForm.department}
                    onChange={(e) => setMappingForm({ ...mappingForm, department: e.target.value })}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
                  >
                    <option value="">Shared / All Departments</option>
                    {LEDGER_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Description"
                    value={mappingForm.description}
                    onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })}
                    style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
                  />
                  <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                    {saving ? 'Saving...' : 'Create Mapping'}
                  </button>
                  <button type="button" onClick={() => setShowMappingForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </form>
              )}
              <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th onClick={() => setSorting({...sorting, mappings: {by: 'type', asc: !sorting.mappings.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.mappings.by === 'type' ? C.p2 : 'transparent' }}>Type {sorting.mappings.by === 'type' && (sorting.mappings.asc ? '▲' : '▼')}</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Department</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Usage</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Active</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings
                      .sort((a, b) => {
                        if (sorting.mappings.by === 'type') {
                          return sorting.mappings.asc
                            ? String(a.mappingType || '').localeCompare(String(b.mappingType || ''))
                            : String(b.mappingType || '').localeCompare(String(a.mappingType || ''))
                        }
                        return 0
                      })
                      .slice((pagination.mappings - 1) * ITEMS_PER_PAGE, pagination.mappings * ITEMS_PER_PAGE)
                      .map((m) => (
                        <tr key={m._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{m.mappingType}</td>
                          <td style={{ padding: '0.75rem', color: C.t2 }}>{m.debitAccountId?.accountCode} - {m.debitAccountId?.accountName}</td>
                          <td style={{ padding: '0.75rem', color: C.t2 }}>{m.creditAccountId?.accountCode} - {m.creditAccountId?.accountName}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ ...getDepartmentBadgeStyle(m.department), padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: '700', textTransform: 'capitalize' }}>
                              {m.department || 'shared'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: m.usageCount > 0 ? C.s1 : C.t3, fontWeight: '600' }}>{m.usageCount || 0}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <input type="checkbox" checked={m.isActive !== false} onChange={async () => {
                              try {
                                await erpAccountingAPI.updateMapping(token, m._id, {isActive: m.isActive === false})
                                await loadMappings()
                                showNotification(m.isActive === false ? '✅ Mapping activated' : '✅ Mapping deactivated')
                              } catch (e) {
                                setError(e.response?.data?.message || 'Failed to toggle mapping')
                              }
                            }} style={{cursor: 'pointer'}} />
                          </td>
                          <td style={{ padding: '0.75rem', color: C.t2 }}>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button onClick={() => setTestMapping(m) || setShowMappingTest(true)} title="Preview" style={{ padding: '0.35rem 0.5rem', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Test</button>
                              <button onClick={() => handleEditMapping(m)} style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                              <button onClick={() => handleDeleteMapping(m)} style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination for Mappings */}
              {Math.ceil(mappings.length / ITEMS_PER_PAGE) > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setPagination({...pagination, mappings: Math.max(1, pagination.mappings - 1)})} disabled={pagination.mappings === 1} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === 1 ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === 1 ? 'default' : 'pointer', borderRadius: '0.35rem'}}>← Prev</button>
                  {Array.from({length: Math.ceil(mappings.length / ITEMS_PER_PAGE)}, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPagination({...pagination, mappings: p})} style={{padding: '0.4rem 0.6rem', background: p === pagination.mappings ? C.s1 : '#E5E7EB', color: p === pagination.mappings ? '#fff' : C.ink, border: 'none', cursor: 'pointer', borderRadius: '0.35rem', fontWeight: p === pagination.mappings ? '600' : '400'}}>{p}</button>
                  ))}
                  <button onClick={() => setPagination({...pagination, mappings: Math.min(Math.ceil(mappings.length / ITEMS_PER_PAGE), pagination.mappings + 1)})} disabled={pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE)} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? 'default' : 'pointer', borderRadius: '0.35rem'}}>Next →</button>
                </div>
              )}
              {mappings.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No mappings configured yet.</p>}
            </div>
  )
}
