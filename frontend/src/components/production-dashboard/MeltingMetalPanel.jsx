import { useState } from 'react'
import { productionControlApi } from '../../api/productionControl'
import { formatGrams, formatPct } from './formatters'
import { metalLoss, lossPercent, numOrNull } from './safeMath'

/**
 * Floor Manager metal review for melting card.
 * Writes only through existing pass issue/receive APIs.
 */
export default function MeltingMetalPanel({ meltingCard, permissions, onDone }) {
  const card = meltingCard
  const [metalOutInput, setMetalOutInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  if (!card) return null

  const inn = card.metalIn
  const outEntered = numOrNull(metalOutInput)
  const out = outEntered ?? card.metalOut
  const loss = metalLoss(inn, out)
  const pct = lossPercent(inn, out)

  async function handleConfirmReceive() {
    setErr(null)
    setMsg(null)
    if (!card.passId) {
      setErr('No open pass for this batch.')
      return
    }
    if (!permissions?.canReceive && !permissions?.canIssue) {
      setErr('You do not have permission to confirm metal weights.')
      return
    }
    const receivedWeight = outEntered ?? card.metalOut
    if (receivedWeight == null) {
      setErr('Enter Metal OUT weight to confirm.')
      return
    }
    setBusy(true)
    try {
      await productionControlApi.receivePass(card.passId, { receivedWeight })
      setMsg('Metal OUT confirmed via existing pass receive workflow.')
      onDone?.()
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pd-panel pd-melting-panel" aria-label="Melting metal control">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Floor Manager · Melting Weights</h2>
        <span className="pd-badge pd-badge--confirm">{card.confirmState || 'Weight pending'}</span>
      </div>
      <div className="pd-metal-grid">
        <div>
          <span className="pd-kpi-label">Metal IN (Entered)</span>
          <div className="pd-kpi-value">{inn != null ? formatGrams(inn) : 'Weight pending'}</div>
        </div>
        <div>
          <span className="pd-kpi-label">Metal OUT</span>
          <div className="pd-kpi-value">{card.metalOut != null ? formatGrams(card.metalOut) : 'Weight pending'}</div>
          {(permissions?.canReceive || permissions?.canIssue) ? (
            <label className="pd-field">
              <span className="pd-kpi-label">Review / Enter Metal OUT (g)</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={metalOutInput}
                onChange={(e) => setMetalOutInput(e.target.value)}
                placeholder={card.metalOut != null ? String(card.metalOut) : ''}
              />
            </label>
          ) : null}
        </div>
        <div>
          <span className="pd-kpi-label">Metal Loss (Calculated)</span>
          <div className="pd-kpi-value">{loss != null ? formatGrams(Math.max(0, loss)) : '—'}</div>
        </div>
        <div>
          <span className="pd-kpi-label">Loss % (Calculated)</span>
          <div className="pd-kpi-value">{pct != null ? formatPct(pct, 1) : '—'}</div>
        </div>
      </div>
      <div className="pd-melting-actions">
        {(permissions?.canReceive || permissions?.canIssue) ? (
          <button type="button" className="pd-btn pd-btn--primary" disabled={busy} onClick={handleConfirmReceive}>
            {busy ? 'Confirming…' : 'Confirm Metal OUT'}
          </button>
        ) : null}
      </div>
      {msg ? <p className="pd-ok" role="status">{msg}</p> : null}
      {err ? <p className="pd-err" role="alert">{err}</p> : null}
      <p className="pd-muted pd-hint">
        Confirm uses the existing pass receive API. Inventory is not adjusted outside the production transaction system.
      </p>
    </section>
  )
}
