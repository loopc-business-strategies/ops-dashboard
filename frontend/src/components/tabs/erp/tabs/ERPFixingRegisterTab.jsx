export default function ERPFixingRegisterTab({
  activeTab,
  C,
  setActiveTab,
  fixingRegPanelOffset,
  fixingRegPanelDrag,
  beginFixingRegPanelDrag,
  handleFixingRegProceed,
  fixingRegLoading,
  fixingRegFilter,
  setFixingRegFilter,
  fixingRegisterStockTypeOptions,
  setFixingRegShown,
  setFixingRegResults,
  setFixingRegError,
  fixingRegError,
  fixingRegShown,
  fixingRegOpening,
  fixingRegResults,
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
}) {
  return (
    <>
      {/* FIXING POSITION REGISTER TAB */}
      {activeTab === 'fixing-register' && (
        <div>
          {/* Back to ERP Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            title="Back to ERP Dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', width: '2rem', height: '2rem', borderRadius: '0.4rem', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#1E3A5F', fontSize: '1rem', cursor: 'pointer' }}
          >←</button>
          {/* Filter card */}
          <div style={{ borderRadius: '0.6rem', overflow: 'hidden', border: '1px solid #CBD5E1', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', maxWidth: 'min(1200px, 100%)', marginBottom: '1.25rem', position: 'relative', transform: `translate(${fixingRegPanelOffset.x}px, ${fixingRegPanelOffset.y}px)`, transition: fixingRegPanelDrag.active ? 'none' : 'transform 120ms ease-out' }}>
            {/* Header */}
            <div onMouseDown={beginFixingRegPanelDrag} style={{ background: 'var(--purple)', padding: '0.85rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 3, cursor: fixingRegPanelDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.03em' }}>Net Position</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleFixingRegProceed() }}
                disabled={fixingRegLoading}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: '0.35rem', border: 'none', background: fixingRegLoading ? 'rgba(255,255,255,0.35)' : '#22C55E', color: '#FFFFFF', fontSize: '0.82rem', fontWeight: '700', cursor: fixingRegLoading ? 'default' : 'pointer' }}
                title="Reload using current filters"
              >
                ↻ Refresh
              </button>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.73rem', letterSpacing: '0.04em' }}>drag</span>
            </div>
            {/* Form body */}
            <div style={{ background: '#F8FAFC', padding: '1.25rem 1.2rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', color: '#475569', letterSpacing: '0.02em' }}>Filter and get statement</p>
              {/* Row 1: Metal | Quantity unit | Rate unit | From | To */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'Metal', field: 'metalType', opts: fixingRegisterStockTypeOptions.map((option) => [option.value, option.label]) },
                  { label: 'Quantity Unit', field: 'quantityUnit', opts: [['GOZ', 'GOZ — Troy Oz'], ['GRAM', 'Gram'], ['KG', 'KG'], ['TOLA', 'Tola']] },
                  { label: 'Rate Unit', field: 'rateUnit', opts: [['GOZ', 'GOZ — per Troy Oz'], ['GRAM', 'per Gram'], ['KG', 'per KG'], ['TOLA', 'per Tola']] },
                ].map(({ label, field, opts }) => {
                  const resolvedOpts = field === 'metalType' && !opts.length
                    ? [
                      ['ALL::all', 'All Metals'],
                      ['XAU::fallback-gold', 'Gold (XAU)'],
                      ['XAG::fallback-silver', 'Silver (XAG)'],
                      ['OTHER::fallback-other', 'Other Metals'],
                    ]
                    : opts
                  return (
                  <div key={field}>
                    <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                    <select
                      value={fixingRegFilter[field]}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                      disabled={false}
                    >
                      {resolvedOpts.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                    </select>
                  </div>
                )})}
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                  <input type="date" value={fixingRegFilter.fromDate}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, fromDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                  <input type="date" value={fixingRegFilter.toDate}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, toDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {/* Row 2: Order By | Group By | All / Selected */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(160px, 1fr) minmax(0, 2fr)', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order By</label>
                  <select
                    value={fixingRegFilter.orderBy}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, orderBy: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                  >
                    <option value="voucherNo">Voucher Number</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group By</label>
                  <select
                    value={fixingRegFilter.groupBy}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, groupBy: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                  >
                    <option value="none">— None —</option>
                    <option value="customer">Customer</option>
                    <option value="branch">Branch</option>
                    <option value="valuedate">Value Date</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '0.12rem', flexWrap: 'wrap' }}>
                  {[['all', 'All'], ['selected', 'Selected']].map(([v, lbl]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#374151', fontSize: '0.83rem', cursor: 'pointer' }}>
                      <input type="radio" name="fixingPartyFilter" value={v} checked={fixingRegFilter.partyFilter === v}
                        onChange={() => setFixingRegFilter(f => ({ ...f, partyFilter: v }))}
                        style={{ accentColor: '#2563EB' }}
                      />
                      {lbl}
                    </label>
                  ))}
                  {fixingRegFilter.partyFilter === 'selected' && (
                    <input
                      type="text"
                      placeholder="Search party…"
                      value={fixingRegFilter.partySearch}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, partySearch: e.target.value }))}
                      style={{ flex: 1, minWidth: '140px', padding: '0.38rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.83rem' }}
                    />
                  )}
                </div>
              </div>
              {/* Row 3: Checkboxes + Status */}
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  ['excludeOpeningBalance', 'Exclude Opening Balance'],
                  ['excludeFutures', 'Exclude Futures'],
                ].map(([field, lbl]) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.38rem', color: '#374151', fontSize: '0.84rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fixingRegFilter[field]}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, [field]: e.target.checked }))}
                      style={{ width: '1rem', height: '1rem', accentColor: '#2563EB' }}
                    />
                    {lbl}
                  </label>
                ))}
                <div style={{ color: '#64748B', fontSize: '0.76rem', lineHeight: 1.35 }}>
                  Unfixing rows affect USD amount balance only; XAU position balance is unchanged.
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                  <select
                    value={fixingRegFilter.status}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, status: e.target.value }))}
                    style={{ padding: '0.38rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.83rem' }}
                  >
                    <option value="preview">Preview (All)</option>
                    <option value="final">Final (Confirmed only)</option>
                  </select>
                </div>
              </div>
              {/* Row 4: Load (applies filters) + back */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => { setFixingRegShown(false); setFixingRegResults([]); setFixingRegError(''); setActiveTab('dashboard') }}
                  style={{ padding: '0.48rem 1.4rem', background: 'transparent', color: '#6B7280', border: '1px solid #CBD5E1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.87rem', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFixingRegProceed}
                  disabled={fixingRegLoading}
                  style={{ padding: '0.52rem 1.75rem', background: fixingRegLoading ? '#86EFAC' : '#16A34A', color: '#FFFFFF', border: 'none', borderRadius: '0.4rem', cursor: fixingRegLoading ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: '700', letterSpacing: '0.02em', boxShadow: fixingRegLoading ? 'none' : '0 1px 3px rgba(22,163,74,0.35)' }}
                >
                  {fixingRegLoading ? 'Loading…' : 'Load'}
                </button>
              </div>
            </div>
          </div>

          {fixingRegLoading && (
            <div style={{ maxWidth: 'min(1200px, 100%)', marginBottom: '0.75rem', padding: '0.85rem 1rem', borderRadius: '0.45rem', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1E3A8A', fontSize: '0.88rem', fontWeight: '600' }}>
              Loading net position…
            </div>
          )}

          {/* Error */}
          {fixingRegError && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.6rem 0.9rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.87rem' }}>
              {fixingRegError}
            </div>
          )}

          {/* Results */}
          {fixingRegShown && !fixingRegLoading && (() => {
            const qUnit = fixingRegFilter.quantityUnit
            const rUnit = fixingRegFilter.rateUnit
            const metalCodeLabel = String(fixingRegFilter.metalType || '').split('::')[0].toUpperCase() || 'ALL'
            const isQtyImpactRow = (row) => {
              const mode = String(row?.fixingMode || '').trim().toLowerCase()
              if (mode === 'unfixing') return false
              return true
            }
            const totalBuyOz = fixingRegResults
              .filter((r) => r.direction === 'buy' && isQtyImpactRow(r))
              .reduce((s, r) => s + Number(r.qty || 0), 0)
            const totalSellOz = fixingRegResults
              .filter((r) => r.direction === 'sell' && isQtyImpactRow(r))
              .reduce((s, r) => s + Number(r.qty || 0), 0)
            const netOz = totalBuyOz - totalSellOz
            const openingQtyOz = fixingRegFilter.excludeOpeningBalance ? 0 : Number(fixingRegOpening.qtyOz || 0)
            const openingValue = fixingRegFilter.excludeOpeningBalance ? 0 : Number(fixingRegOpening.value || 0)
            const closingQtyOz = openingQtyOz + netOz
            const getRowSignedValue = (row) => {
              const amount = Number(row?.amount || 0)
              const mode = String(row?.fixingMode || '').trim().toLowerCase()
              if (mode === 'unfixing') return amount
              return String(row?.direction || '').toLowerCase() === 'buy' ? amount : -amount
            }
            const txnNetValue = fixingRegResults.reduce((sum, row) => {
              return sum + getRowSignedValue(row)
            }, 0)
            const closingValue = openingValue + txnNetValue
            const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
            const fmtSignedAmt = (v) => {
              const amount = Number(v || 0)
              const abs = fixingRegFmtAmt(Math.abs(amount))
              if (amount < 0) return `(${abs})`
              return abs
            }
            const fmtSignedQty = (v) => {
              const value = Number(v || 0)
              const abs = fixingRegFmtQty(Math.abs(value), qUnit)
              if (value < 0) return `(${abs})`
              return abs
            }
            const fmtSignedRate = (v) => {
              const value = Number(v || 0)
              const abs = fixingRegFmtRate(Math.abs(value), rUnit)
              if (value < 0) return `(${abs})`
              return abs
            }
            const legacyHead1 = {
              padding: '0.24rem 0.38rem',
              border: '1px solid #8F949B',
              color: '#2F3A44',
              fontWeight: '700',
              fontSize: '0.69rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              background: '#E5C183',
              lineHeight: 1.05,
            }
            const legacyHead2 = {
              padding: '0.2rem 0.38rem',
              border: '1px solid #9BA1A9',
              color: '#2F3A44',
              fontWeight: '700',
              fontSize: '0.67rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              background: '#F2DEB5',
              lineHeight: 1.05,
            }
            const legacyCell = {
              padding: '0.24rem 0.4rem',
              border: '1px solid #C6CBD2',
              color: '#1F2937',
              lineHeight: 1.1,
            }
            const numericCell = {
              ...legacyCell,
              textAlign: 'right',
              fontWeight: '600',
              color: '#0F172A',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
            }
            let runningQtyOz = openingQtyOz
            let runningAmount = openingValue

            return (
              <div style={{ marginTop: '1rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', background: '#FFFFFF', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden', maxWidth: 'min(1200px, 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid #E5E7EB', background: '#FFFBF0' }}>
                  <div>
                    <h4 style={{ margin: 0, color: C.ink, fontSize: '1.05rem', fontWeight: '700' }}>Net Position</h4>
                    <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Sale, purchase, and direct deal lines for the current filter set.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleFixingRegProceed}
                      disabled={fixingRegLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.9rem', borderRadius: '0.35rem', border: 'none', background: fixingRegLoading ? '#86EFAC' : '#16A34A', color: '#FFFFFF', fontSize: '0.82rem', fontWeight: '700', cursor: fixingRegLoading ? 'default' : 'pointer' }}
                    >
                      ↻ Refresh
                    </button>
                    <button type="button" onClick={() => setFixingRegShown(false)} style={{ padding: '0.42rem 0.75rem', border: '1px solid #D1D5DB', background: '#FFFFFF', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Close</button>
                  </div>
                </div>

                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                      { label: 'Total Buy', value: `${fixingRegFmtQty(totalBuyOz, qUnit)} ${qUnit}`, bg: '#DCFCE7', color: '#15803D' },
                      { label: 'Total Sell', value: `${fixingRegFmtQty(totalSellOz, qUnit)} ${qUnit}`, bg: '#FEE2E2', color: '#DC2626' },
                      { label: 'Net Position', value: `${netOz >= 0 ? '+' : '-'}${fixingRegFmtQty(Math.abs(netOz), qUnit)} ${qUnit}`, bg: '#DBEAFE', color: netOz >= 0 ? '#1D4ED8' : '#B45309' },
                      { label: 'Records', value: String(fixingRegResults.length), bg: '#F3F4F6', color: '#111827' },
                    ].map((card) => (
                      <div key={card.label} style={{ background: card.bg, padding: '0.75rem 0.9rem', borderRadius: '0.45rem', border: '1px solid rgba(0,0,0,0.04)', minWidth: 0 }}>
                        <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{card.label}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: card.color, lineHeight: 1.2 }}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ overflow: 'auto', border: '1px solid #8F98A6', borderRadius: '0.24rem', background: '#FCFCFC', maxHeight: 'min(70vh, 720px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '1320px', fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                      <colgroup>
                        <col style={{ width: '40px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '360px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '95px' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#EBC788' }}>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'right' }}>#</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Doc Date</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Val Date</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Doc No</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Description</th>
                          <th colSpan={3} style={{ ...legacyHead1, textAlign: 'center' }}>{`${metalCodeLabel} (${qUnit})`}</th>
                          <th colSpan={3} style={{ ...legacyHead1, textAlign: 'center' }}>Amount (USD)</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'right' }}>Average</th>
                        </tr>
                        <tr style={{ background: '#F6E2BA' }}>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>In</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Out</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Balance</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>{`Rate (${rUnit})`}</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Value</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#FBF4E5' }}>
                          <td style={{ ...legacyCell, textAlign: 'right', color: '#64748B' }}>-</td>
                          <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>-</td>
                          <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>-</td>
                          <td style={{ ...legacyCell, color: '#111827', fontWeight: '700' }}>Opening C/F</td>
                          <td style={{ ...legacyCell, color: '#4B5563' }}>Opening Carry Forward</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={numericCell}>{fmtSignedQty(openingQtyOz)}</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={numericCell}>{fmtSignedAmt(openingValue)}</td>
                          <td style={numericCell}>{runningQtyOz !== 0 ? fmtSignedRate(runningAmount / runningQtyOz) : '-'}</td>
                        </tr>
                        {fixingRegResults.map((row, idx) => (
                          (() => {
                            const qtyOz = Number(row.qty || 0)
                            const isBuy = String(row.direction || '').toLowerCase() === 'buy'
                            const isQtyImpactEnabled = isQtyImpactRow(row)
                            const qtyInOz = isBuy ? qtyOz : 0
                            const qtyOutOz = isBuy ? 0 : qtyOz
                            const signedQtyOz = isQtyImpactEnabled ? (isBuy ? qtyOz : -qtyOz) : 0
                            const signedValue = getRowSignedValue(row)
                            runningQtyOz += signedQtyOz
                            runningAmount += signedValue
                            const avgRate = runningQtyOz !== 0 ? (runningAmount / runningQtyOz) : null
                            return (
                          <tr key={row.rowId || `${row.voucherNo}-${idx}`} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FCFAF4' }}>
                            <td style={{ ...legacyCell, textAlign: 'right', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(row.docDate)}</td>
                            <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(row.valueDate)}</td>
                            <td style={{ ...legacyCell, color: '#111827', fontWeight: '700' }}>{row.voucherNo || '-'}</td>
                            <td style={{ ...legacyCell, color: '#4B5563', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.02rem 0.34rem',
                                  marginRight: '0.32rem',
                                  borderRadius: '0.2rem',
                                  fontSize: '0.64rem',
                                  fontWeight: '700',
                                  background: row.fixingMode === 'Unfixing' ? '#FEF3C7' : '#DCFCE7',
                                  color: row.fixingMode === 'Unfixing' ? '#92400E' : '#166534',
                                  border: row.fixingMode === 'Unfixing' ? '1px solid #FCD34D' : '1px solid #86EFAC',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {row.fixingMode || 'Fixing'}
                              </span>
                              {row.remarks || `${row.sourceType || ''} ${row.customerName || ''}`.trim() || '-'}
                            </td>
                            <td style={numericCell}>{qtyInOz > 0 ? fixingRegFmtQty(qtyInOz, qUnit) : '-'}</td>
                            <td style={numericCell}>{qtyOutOz > 0 ? fixingRegFmtQty(qtyOutOz, qUnit) : '-'}</td>
                            <td style={numericCell}>{fmtSignedQty(runningQtyOz)}</td>
                            <td style={numericCell}>{fixingRegFmtRate(Number(row.price || 0), rUnit)}</td>
                            <td style={numericCell}>{fmtSignedAmt(signedValue)}</td>
                            <td style={numericCell}>{fmtSignedAmt(runningAmount)}</td>
                            <td style={numericCell}>{avgRate === null ? '-' : fmtSignedRate(avgRate)}</td>
                          </tr>
                            )
                          })()
                        ))}
                        <tr style={{ background: '#F4D9A3' }}>
                          <td style={{ ...legacyCell, textAlign: 'right', color: '#78350F', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', whiteSpace: 'nowrap', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', whiteSpace: 'nowrap', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', fontWeight: '700' }}>Closing C/F</td>
                          <td style={{ ...legacyCell, color: '#78350F', fontWeight: '700' }}>Closing Carry Forward</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fixingRegFmtQty(totalBuyOz, qUnit)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fixingRegFmtQty(totalSellOz, qUnit)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedQty(closingQtyOz)}</td>
                          <td style={{ ...numericCell, color: '#78350F', fontWeight: '700' }}>-</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedAmt(txnNetValue)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedAmt(closingValue)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{closingQtyOz !== 0 ? fmtSignedRate(closingValue / closingQtyOz) : '-'}</td>
                        </tr>
                        {fixingRegResults.length === 0 && (
                          <tr>
                            <td colSpan={12} style={{ padding: '0.8rem', textAlign: 'center', color: C.inkSoft }}>No transactions found for selected date range and filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </>
  )
}