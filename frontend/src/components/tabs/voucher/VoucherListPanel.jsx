import { btn, computeVoucherGrandTotal, fmt, inputStyle, isMetalStockVoucherType, S } from './voucherTabShared'

const STATUS_COLORS = {
  draft: { bg: '#FEF3C7', color: '#92400E' },
  submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
  approved: { bg: '#DCFCE7', color: '#166534' },
  posted: { bg: '#D1FAE5', color: '#065F46' },
  returned: { bg: '#FCE7F3', color: '#9D174D' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C' },
}

export default function VoucherListPanel({
  voucherLabel,
  voucherType,
  isSimpleMetalVoucher,
  selectedStatus,
  onSelectedStatusChange,
  t,
  loadVouchers,
  canCreate,
  loadingList,
  filteredVouchers,
  openCreate,
  openVoucher,
  isReadOnly,
  saving,
  handleListWorkflowAction,
  canManageWorkflow,
  isSuperAdmin,
  isFinance,
  handleVoidVoucher,
  handleRevalueFxJournal,
  displayVoucherDocNo,
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: S.ink }}>
          {voucherLabel} — List
        </h3>
        <select
          value={selectedStatus}
          onChange={(e) => onSelectedStatusChange(e.target.value)}
          style={{ ...inputStyle, width: '140px' }}
        >
          <option value="">{t('all')} {t('status')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="submitted">{t('statusSubmitted')}</option>
          <option value="approved">{t('statusApproved')}</option>
          <option value="posted">{t('statusPosted')}</option>
          <option value="returned">{t('statusReturned')}</option>
          <option value="rejected">{t('statusRejected')}</option>
        </select>
        <button type="button" style={btn('gray')} onClick={loadVouchers}>↺ Refresh</button>
        {canCreate && (
          <button type="button" style={{ ...btn('primary'), marginLeft: 'auto' }} onClick={() => openCreate()}>+ New</button>
        )}
      </div>

      {loadingList ? (
        <p style={{ color: S.muted }}>{t('loading')}</p>
      ) : filteredVouchers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: S.muted, border: `2px dashed ${S.border}`, borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <p>No {voucherLabel.toLowerCase()}s found.</p>
          {canCreate && (
            <button type="button" style={{ ...btn('primary'), marginTop: '1rem' }} onClick={() => openCreate()}>
              + New {voucherLabel}
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: S.headerBg }}>
                {['Doc No', 'Doc Date', ...(isSimpleMetalVoucher ? [] : ['Value Date']), 'Party Code', 'Party Name', ...(isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher ? ['Fixing'] : []), ...(isSimpleMetalVoucher ? [] : ['Currency']), 'Grand Total', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `2px solid ${S.border}`, whiteSpace: 'nowrap' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.map((voucher, index) => {
                const meta = voucher.voucherMeta || {}
                const grand = computeVoucherGrandTotal(voucher, voucherType)
                const statusStyle = STATUS_COLORS[voucher.status] || { bg: '#F3F4F6', color: '#374151' }
                const fixingDisplay = meta.fixingType === 'non-fixing' ? 'Unfixed' : 'Fixed'
                return (
                  <tr key={voucher._id} style={{ background: index % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', color: S.green }}>{displayVoucherDocNo(voucher)}</td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>{meta.docDate ? String(meta.docDate).slice(0, 10) : (voucher.date ? voucher.date.slice(0, 10) : '-')}</td>
                    {!isSimpleMetalVoucher && (
                      <td style={{ padding: '0.55rem 0.75rem' }}>{meta.valueDate ? String(meta.valueDate).slice(0, 10) : (voucher.date ? voucher.date.slice(0, 10) : '-')}</td>
                    )}
                    <td style={{ padding: '0.55rem 0.75rem' }}>{meta.partyCode || '-'}</td>
                    <td style={{ padding: '0.55rem 0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.partyName || '-'}</td>
                    {isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher && (
                      <td style={{ padding: '0.55rem 0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', background: fixingDisplay === 'Unfixed' ? '#FEE2E2' : '#DCFCE7', color: fixingDisplay === 'Unfixed' ? '#B91C1C' : '#166534' }}>
                          {fixingDisplay}
                        </span>
                      </td>
                    )}
                    {!isSimpleMetalVoucher && (
                      <td style={{ padding: '0.55rem 0.75rem' }}>{voucher.currency}</td>
                    )}
                    <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', textAlign: 'right' }}>{fmt(grand)}</td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', background: statusStyle.bg, color: statusStyle.color }}>
                        {voucher.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" style={{ ...btn('secondary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }} onClick={() => openVoucher(voucher)}>
                          {isReadOnly ? 'View' : 'Open'}
                        </button>
                        {!isReadOnly && ['draft', 'returned', 'rejected'].includes(voucher.status) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleListWorkflowAction(voucher, 'submit')}
                            style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#F59E0B', color: '#111827' }}
                          >
                            {t('submit')}
                          </button>
                        )}
                        {canManageWorkflow && voucher.status === 'submitted' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleListWorkflowAction(voucher, 'approve')}
                            style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#0EA5E9', color: '#FFFFFF' }}
                          >
                            {t('approve')}
                          </button>
                        )}
                        {canManageWorkflow && ['submitted', 'approved'].includes(voucher.status) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleListWorkflowAction(voucher, 'return')}
                            style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#F472B6', color: '#831843' }}
                          >
                            {t('returnForEdit')}
                          </button>
                        )}
                        {canManageWorkflow && ['submitted', 'approved', 'returned'].includes(voucher.status) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleListWorkflowAction(voucher, 'reject')}
                            style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#FEE2E2', color: '#B91C1C' }}
                          >
                            {t('reject')}
                          </button>
                        )}
                        {canManageWorkflow && ['submitted', 'approved'].includes(voucher.status) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleListWorkflowAction(voucher, 'post')}
                            style={{ ...btn('primary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          >
                            {t('post')}
                          </button>
                        )}
                        {(isSuperAdmin || isFinance) && voucher.status === 'posted' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleVoidVoucher(voucher)}
                            style={{ ...btn('danger'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          >
                            Void
                          </button>
                        )}
                        {isSuperAdmin && ['receipt', 'payment'].includes(String(voucher.type || voucherType).toLowerCase()) && voucher.status === 'posted' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleRevalueFxJournal(voucher)}
                            style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#E0F2FE', color: '#0C4A6E' }}
                          >
                            Revalue FX
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ marginTop: '0.5rem', color: S.muted, fontSize: '0.8rem' }}>{filteredVouchers.length} voucher(s)</p>
        </div>
      )}
    </div>
  )
}
