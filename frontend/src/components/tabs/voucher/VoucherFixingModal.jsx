import { useEffect, useMemo, useState } from 'react'
import { btn, fmt, inputStyle, S } from './voucherTabShared'
import {
  VOUCHER_FIXING_RATE_TYPES,
  computeVoucherFixingAmount,
  fromPerOunceRate,
  summarizeVoucherFixing,
  toPerOunceRate,
} from './voucherFixingHelpers'
import {
  checkDirectDealPriceAgainstSpot,
  describeDirectDealPriceDeviation,
  resolveSpotPricePerOz,
} from '../directDealPriceCheck'

const todayIso = () => new Date().toISOString().slice(0, 10)

const formatGrams = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

export default function VoucherFixingModal({
  voucher,
  docNo,
  liveSnapshot,
  saving = false,
  error = '',
  canManage = false,
  onClose,
  onFix,
  onRemove,
}) {
  const state = useMemo(() => summarizeVoucherFixing(voucher), [voucher])
  const currency = String(voucher?.currency || 'USD').toUpperCase()
  const spotCurrency = String(liveSnapshot?.currency || 'USD').toUpperCase()
  const spotPerOz = spotCurrency === currency ? resolveSpotPricePerOz(liveSnapshot, state.metalCode || 'XAU') : 0

  const [date, setDate] = useState(todayIso)
  const [grams, setGrams] = useState('')
  const [rateType, setRateType] = useState(state.rateType)
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setDate(todayIso())
    setGrams(state.openWeight > 0 ? String(state.openWeight) : '')
    setRateType(state.rateType)
    setRate('')
    setNotes('')
  }, [voucher?._id, state.openWeight, state.rateType])

  const gramsValue = Number(grams || 0)
  const rateValue = Number(rate || 0)
  const amount = computeVoucherFixingAmount({ pureWeight: gramsValue, rate: rateValue, rateType })
  const priceCheck = checkDirectDealPriceAgainstSpot({
    price: toPerOunceRate(rateValue, rateType),
    metal: state.metalCode || 'XAU',
    currency,
    snapshot: liveSnapshot,
  })
  const gramsTooHigh = gramsValue > state.openWeight + 0.0005
  const canSubmit = canManage && !saving && gramsValue > 0 && !gramsTooHigh && rateValue > 0 && Boolean(date)

  const submit = () => {
    if (!canSubmit) return
    if (priceCheck) {
      const warning = describeDirectDealPriceDeviation(priceCheck, (v) => fmt(v, currency))
      if (!window.confirm(`The fixing rate is ${warning}.\nFix anyway?`)) return
    }
    onFix({ date, pureWeight: gramsValue, rate: rateValue, rateType, notes: notes.trim() })
  }

  if (!voucher) return null
  const meta = voucher.voucherMeta || {}
  const sideLabel = String(voucher.type || '').toLowerCase() === 'sale' ? 'Sale' : 'Purchase'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fix ${docNo}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}
    >
      <div style={{ background: S.white, borderRadius: '12px', width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: S.ink }}>Fix {sideLabel.toLowerCase()} {docNo}</h3>
          <span style={{ color: S.muted, fontSize: '0.85rem' }}>{meta.partyName || meta.partyCode || ''}</span>
          <button type="button" style={{ ...btn('secondary'), marginLeft: 'auto', padding: '0.25rem 0.7rem' }} onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '1rem' }}>
          {error ? (
            <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontWeight: 600 }}>
              {error}
            </div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
            {[
              ['Voucher grams', state.totalWeight],
              ['Already fixed', state.fixedWeight],
              ['Still unfixed', state.openWeight],
            ].map(([label, value]) => (
              <div key={label} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: S.muted }}>{label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: S.ink }}>{formatGrams(value)} g</div>
              </div>
            ))}
          </div>

          {state.allFixings.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: S.headerBg }}>
                  {['Date', 'Grams', 'Rate', 'Amount', 'Status', ''].map((heading) => (
                    <th key={heading} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: `1px solid ${S.border}` }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.allFixings.map((fixing) => (
                  <tr key={fixing._id} style={{ borderBottom: `1px solid ${S.border}`, color: fixing.isDeleted ? S.muted : S.ink }}>
                    <td style={{ padding: '0.45rem 0.6rem' }}>{fixing.date ? String(fixing.date).slice(0, 10) : '-'}</td>
                    <td style={{ padding: '0.45rem 0.6rem' }}>{formatGrams(fixing.pureWeight)} g</td>
                    <td style={{ padding: '0.45rem 0.6rem' }}>{fmt(fixing.rate, fixing.currency || currency)} / {String(fixing.rateType || 'OZ').toLowerCase()}</td>
                    <td style={{ padding: '0.45rem 0.6rem' }}>{fmt(fixing.amount, fixing.currency || currency)}</td>
                    <td style={{ padding: '0.45rem 0.6rem' }}>{fixing.isDeleted ? 'Removed' : 'Active'}</td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>
                      {canManage && !fixing.isDeleted && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onRemove(fixing)}
                          style={{ ...btn('gray'), padding: '0.2rem 0.55rem', fontSize: '0.75rem', background: '#FEE2E2', color: '#B91C1C' }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {state.openWeight > 0 && canManage ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: S.muted }}>
                  Fixing date
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: S.muted }}>
                  Grams to fix (max {formatGrams(state.openWeight)})
                  <input type="number" min="0" step="0.001" value={grams} onChange={(event) => setGrams(event.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: S.muted }}>
                  Rate ({currency} per {rateType.toLowerCase()})
                  <input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: S.muted }}>
                  Rate unit
                  <select value={rateType} onChange={(event) => setRateType(event.target.value)} style={inputStyle}>
                    {VOUCHER_FIXING_RATE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: S.muted }}>
                Notes
                <input type="text" value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} style={inputStyle} />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                {spotPerOz > 0 && (
                  <button
                    type="button"
                    style={{ ...btn('secondary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                    onClick={() => setRate(String(Number(fromPerOunceRate(spotPerOz, rateType).toFixed(4))))}
                  >
                    Use live {fmt(spotPerOz, currency)} / oz
                  </button>
                )}
                <span style={{ color: S.ink }}>
                  Amount: <strong>{fmt(amount, currency)}</strong>
                  {' '}({sideLabel === 'Purchase' ? 'credited to' : 'debited to'} the party)
                </span>
              </div>
              {gramsTooHigh && (
                <div style={{ color: S.danger, fontSize: '0.8rem', fontWeight: 600 }}>
                  Only {formatGrams(state.openWeight)} g is still unfixed on this voucher.
                </div>
              )}
              {priceCheck && (
                <div style={{ color: S.danger, fontSize: '0.8rem', fontWeight: 600 }}>
                  Rate is {describeDirectDealPriceDeviation(priceCheck, (v) => fmt(v, currency))}
                </div>
              )}
              <div style={{ color: S.muted, fontSize: '0.78rem' }}>
                Posts the metal value on the fixing date. The voucher and its stock are not changed.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" style={btn('secondary')} onClick={onClose} disabled={saving}>Cancel</button>
                <button type="button" style={{ ...btn('primary'), opacity: canSubmit ? 1 : 0.6 }} onClick={submit} disabled={!canSubmit}>
                  {saving ? 'Saving…' : 'Fix'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: S.muted, fontSize: '0.85rem' }}>
              {state.openWeight > 0 ? 'Only Admin/Finance can fix vouchers.' : 'All grams on this voucher are fixed.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
