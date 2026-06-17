import { ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import { exchangeRateFromUnitsPerBase } from '../erpCurrencyRowHelpers'

export default function ERPCurrenciesTab({
  C,
  erpBaseCurrencyCode,
  canManageAccounts,
  showCurrencyForm,
  setShowCurrencyForm,
  handleSyncCurrencyMaster,
  saving,
  setActiveTabGuarded,
  usdConversion,
  setUsdConversion,
  usdToTargetAmount,
  selectedUsdConversionRate,
  currencyForm,
  setCurrencyForm,
  handleCreateCurrency,
  currencies,
  handleEditCurrency,
  handleDeleteCurrency,
}) {
  return (
    <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Currency Master</h3>
                  <p style={{ margin: '0.3rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>
                    {`Manage currency code master and conversion rates vs ${erpBaseCurrencyCode} for all ERP postings.`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canManageAccounts && (
                    <button
                      onClick={() => setShowCurrencyForm(!showCurrencyForm)}
                      style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {showCurrencyForm ? 'Close Form' : '+ Add Currency'}
                    </button>
                  )}
                  {canManageAccounts && (
                    <button
                      onClick={handleSyncCurrencyMaster}
                      disabled={saving}
                      style={{ padding: '0.5rem 1rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {saving ? 'Syncing...' : 'Sync USD/EUR/AED/UZS'}
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTabGuarded('settings')}
                    style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}
                  >
                    Back to Settings
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>Exchange Difference Accounts</h4>
                  <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                    System auto-creates and uses <strong>Exchange Gain (4190)</strong> and <strong>Exchange Loss (5190)</strong> when posting foreign-currency payment/receipt adjustments.
                  </p>
                </div>
                <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>{`Rate Direction (vs ${erpBaseCurrencyCode})`}</h4>
                  <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                    Exchange rate stores the <strong>{erpBaseCurrencyCode}</strong> value of <strong>1 unit</strong> of that currency code (base units per 1 unit of FC). Example when base is USD: AED 0.2723 means 1 AED = 0.2723 USD. When base is INR: USD 83.5 means 1 USD = 83.5 INR. When adding or editing, you can instead fill <strong>1 {erpBaseCurrencyCode} = (units)</strong> — the app saves <code>1 ÷ that number</code> so the grid matches.
                  </p>
                </div>
                <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>USD amount converter</h4>
                  <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                    {erpBaseCurrencyCode === 'USD'
                      ? 'Uses stored rates (USD per 1 unit of the target currency).'
                      : `Converts USD → ${erpBaseCurrencyCode} using the USD row, then → target using each row’s ${erpBaseCurrencyCode} per 1 unit.`}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="USD Amount"
                      value={usdConversion.usdAmount}
                      onChange={(e) => setUsdConversion((prev) => ({ ...prev, usdAmount: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <select
                      value={usdConversion.targetCode}
                      onChange={(e) => setUsdConversion((prev) => ({ ...prev, targetCode: e.target.value }))}
                      style={ERP_MODAL_INPUT_STYLE}
                    >
                      {currencies.map((currency) => (
                        <option key={currency._id || currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
                      ))}
                    </select>
                  </div>
                  <p style={{ margin: '0.5rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
                    {usdConversion.usdAmount || '0'} USD = <strong style={{ color: C.ink }}>{Number(usdToTargetAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> {usdConversion.targetCode || '---'}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.75rem' }}>
                    1 {usdConversion.targetCode || '---'} = <strong style={{ color: C.ink }}>{Number(selectedUsdConversionRate || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong> {erpBaseCurrencyCode}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.72rem' }}>
                    Rate used: {selectedUsdConversionRate > 0 ? selectedUsdConversionRate.toFixed(6) : 'N/A'} {erpBaseCurrencyCode} per {usdConversion.targetCode || 'unit'}
                  </p>
                </div>
              </div>
              {showCurrencyForm && (
                <form onSubmit={handleCreateCurrency} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: `1px solid ${C.p2}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                    <input
                      placeholder="Currency Code"
                      value={currencyForm.code}
                      onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Currency Name"
                      value={currencyForm.name}
                      onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      placeholder="Symbol"
                      value={currencyForm.symbol}
                      onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                      style={ERP_MODAL_INPUT_STYLE}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="Exchange Rate"
                      value={currencyForm.exchangeRate}
                      onChange={(e) => setCurrencyForm({ ...currencyForm, exchangeRate: e.target.value, oneUsdEquals: '' })}
                      style={ERP_MODAL_INPUT_STYLE}
                      disabled={currencyForm.baseCurrency}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`1 ${erpBaseCurrencyCode} = (units of this currency)`}
                      value={currencyForm.oneUsdEquals}
                      onChange={(e) => {
                        const v = e.target.value
                        const r = exchangeRateFromUnitsPerBase(v)
                        setCurrencyForm({
                          ...currencyForm,
                          oneUsdEquals: v,
                          exchangeRate: r !== null ? String(r) : currencyForm.exchangeRate,
                        })
                      }}
                      style={ERP_MODAL_INPUT_STYLE}
                      disabled={currencyForm.baseCurrency}
                    />
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: C.ink, marginTop: '0.6rem' }}>
                    <input
                      type="checkbox"
                      checked={currencyForm.baseCurrency}
                      onChange={(e) => {
                        const base = e.target.checked
                        setCurrencyForm({
                          ...currencyForm,
                          baseCurrency: base,
                          exchangeRate: base ? 1 : currencyForm.exchangeRate,
                          oneUsdEquals: base ? '' : currencyForm.oneUsdEquals,
                        })
                      }}
                    />
                    Set as base currency
                  </label>
                  <div style={{ marginTop: '0.75rem' }}>
                    <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                      {saving ? 'Saving...' : 'Create Currency'}
                    </button>
                    <button type="button" onClick={() => setShowCurrencyForm(false)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Code</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Symbol</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Exchange Rate</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>{`1 ${erpBaseCurrencyCode} =`}</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Base</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Active</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.map((c) => (
                      <tr key={c._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '700' }}>{c.code}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{c.name}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{c.symbol || '-'}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>{Number(c.exchangeRate || 0).toFixed(6)}</td>
                        <td style={{ padding: '0.75rem', color: C.t2 }}>
                          {c.baseCurrency
                            ? '—'
                            : (Number(c.exchangeRate || 0) > 0
                              ? Number(1 / Number(c.exchangeRate || 1)).toLocaleString(undefined, { maximumFractionDigits: 4 })
                              : '-')}
                        </td>
                        <td style={{ padding: '0.75rem', color: c.baseCurrency ? C.s1 : C.t2 }}>{c.baseCurrency ? '✓ Base' : '-'}</td>
                        <td style={{ padding: '0.75rem', color: c.isActive ? '#065F46' : C.inkSoft }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <button onClick={() => handleEditCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDeleteCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {currencies.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No currencies configured yet.</p>}
            </div>
  )
}
