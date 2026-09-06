import {
  formatCustomerMarginAmount,
  formatCustomerMarginEquity,
  formatCustomerMarginExcessShort,
  formatCustomerMarginPercent,
  formatCustomerMarginPosition,
} from '../marginFormatters'
import ErpMetalLivePricesBar from '../ErpMetalLivePricesBar'

export default function ERPCustomerMarginTab({
  C,
  setActiveTabGuarded,
  customerMarginSort,
  setCustomerMarginSort,
  customerMarginCompactView,
  setCustomerMarginCompactView,
  customerMarginSearch,
  setCustomerMarginSearch,
  customerMarginRows,
  handleCustomerMarginRowContextMenu,
  customerMarginContextMenu,
}) {
  return (
    <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setActiveTabGuarded('dashboard')}
                    title="Back to ERP Dashboard"
                    style={{ background: 'none', border: '1px solid var(--brand-border)', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--brand-on-soft)', display: 'flex', alignItems: 'center', lineHeight: 1, fontWeight: '700' }}
                  >←</button>
                  <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customer Margin</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <select
                    value={customerMarginSort}
                    onChange={(e) => setCustomerMarginSort(e.target.value)}
                    style={{ padding: '0.48rem 0.62rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink, fontSize: '0.82rem' }}
                  >
                    <option value="margin-desc">Sort: Margin % (High to Low)</option>
                    <option value="margin-asc">Sort: Margin % (Low to High)</option>
                    <option value="name-asc">Sort: Name (A-Z)</option>
                  </select>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', color: C.inkSoft, fontSize: '0.82rem', fontWeight: '600' }}>
                    <input
                      type="checkbox"
                      checked={customerMarginCompactView}
                      onChange={(e) => setCustomerMarginCompactView(e.target.checked)}
                    />
                    Fixed List Area
                  </label>
                  <input
                    placeholder="Search customer"
                    value={customerMarginSearch}
                    onChange={(e) => setCustomerMarginSearch(e.target.value)}
                    style={{ width: 'min(320px, 100%)', padding: '0.5rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink }}
                  />
                </div>
              </div>
              <ErpMetalLivePricesBar />
              <div className="erp-table-wrap" style={{ borderRadius: '0.45rem' }}>
                <div style={{ background: 'var(--brand-soft)', borderBottom: '1px solid var(--brand-border)', padding: '0.55rem 0.8rem', fontSize: '1rem', fontWeight: '700', color: 'var(--brand-on-soft)' }}>
                  Customer Margin
                </div>
                <div style={{ overflowX: 'auto', overflowY: customerMarginCompactView ? 'auto' : 'visible', maxHeight: customerMarginCompactView ? '380px' : 'none' }}>
                  <table className="erp-table erp-table--compact">
                    <colgroup>
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th className="num">Gold Position</th>
                        <th className="num">Silver Position</th>
                        <th className="num">Equity</th>
                        <th className="num">Margin</th>
                        <th className="num">Excess</th>
                        <th className="num">Status</th>
                        <th className="num">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerMarginRows.map((row, index) => {
                        const isNegative = row.status === 'NEGATIVE'
                        const isPositive = row.status === 'POSITIVE'
                        const statusColor = isNegative ? '#DC2626' : isPositive ? '#059669' : 'var(--text-primary, #111827)'
                        const textPrimary = 'var(--text-primary, #111827)'
                        const signedColor = (n) => (Number(n || 0) < 0 ? '#DC2626' : textPrimary)
                        return (
                          <tr
                            key={row.id || index}
                            onClick={(event) => handleCustomerMarginRowContextMenu(event, row)}
                            onContextMenu={(event) => handleCustomerMarginRowContextMenu(event, row)}
                            title="Click or right click to open details submenu"
                            style={{ borderBottom: '1px solid var(--border, #EEF2F7)', background: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC', height: '30px', cursor: 'context-menu' }}
                          >
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', color: textPrimary, fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.customerName}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: signedColor(row.goldPosition), fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.goldPosition)}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: signedColor(row.silverPosition), fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(row.silverPosition)}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: signedColor(row.equity), fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity(row)}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: textPrimary, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(row.marginAmount)}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: signedColor(row.excess), fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity({ equity: row.excess })}</td>
                            <td style={{ borderRight: '1px solid var(--border, #EEF3F9)', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: statusColor, fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.035em', lineHeight: 1.08 }}>{row.status}</td>
                            <td style={{ padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: statusColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(row.marginPercent)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {customerMarginContextMenu.open && customerMarginContextMenu.row && (
                <div
                  onClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                  style={{
                    position: 'fixed',
                    top: `${customerMarginContextMenu.y}px`,
                    left: `${customerMarginContextMenu.x}px`,
                    width: '292px',
                    background: '#FFFFFF',
                    border: '1px solid var(--brand-border, var(--border))',
                    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)',
                    zIndex: 2000,
                    borderRadius: '0.2rem',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--brand-border)', background: 'var(--brand-soft)', color: 'var(--brand-on-soft)', fontSize: '0.76rem', fontWeight: '700', letterSpacing: '0.03em' }}>
                    CUSTOMER MARGIN SUB MENU
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', fontSize: '0.78rem' }}>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Account Code</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827' }}>{customerMarginContextMenu.row.accountCode || '-'}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Description</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerMarginContextMenu.row.description || '-'}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Gold Position</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(customerMarginContextMenu.row.goldPosition)}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Silver Position</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPosition(customerMarginContextMenu.row.silverPosition)}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Excess/Short</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginExcessShort(customerMarginContextMenu.row)}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid var(--border, #E8EEF7)', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Margin</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginAmount(customerMarginContextMenu.row.marginAmount)}</div>
                    <div style={{ padding: '0.34rem 0.52rem', borderRight: '1px solid var(--border, #E8EEF7)', color: 'var(--brand-on-soft)', fontWeight: '700' }}>Margin %</div>
                    <div style={{ padding: '0.34rem 0.52rem', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(customerMarginContextMenu.row.marginPercent)}</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                Equity shows signed exposure: positive values are favorable, negative values are payable.
              </div>
              {customerMarginRows.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers available for margin view.</p>}
            </div>
  )
}
