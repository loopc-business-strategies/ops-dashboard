import {
  fmtMoveRow,
  fmtSpot,
  metalStatusSubline,
} from '../utils/liveMetalRates'
import useLiveMetalRates from '../hooks/useLiveMetalRates'

const METALS = [
  { key: 'gold', label: 'Gold', swatch: '#FACC15', sym: 'Au', labelColor: '#92400E' },
  { key: 'silver', label: 'Silver', swatch: '#CBD5E1', sym: 'Ag', labelColor: '#475569' },
  { key: 'platinum', label: 'Platinum', swatch: '#A855F7', sym: 'Pt', labelColor: '#6B21A8' },
]

/**
 * Tenant top bar: live Gold / Silver / Platinum spot from ERP metal-rates API.
 * Second row shows movement since the previous live snapshot once one exists.
 */
export default function TopbarMetalTickers() {
  const { snapshot, error } = useLiveMetalRates()

  const pillBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.4rem 0.75rem',
    borderRadius: '999px',
    background: '#fff',
    border: '1px solid var(--border)',
    minWidth: '8.75rem',
    flexShrink: 0,
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  }

  return (
    <div className="flex items-center justify-end gap-2 min-w-0 flex-wrap" style={{ rowGap: 6 }}>
      {METALS.map(({ key, label, swatch, sym, labelColor }) => {
        const price = snapshot[key]
        const move = snapshot.deltas && snapshot.prevSnapshot
          ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
          : null

        return (
          <div
            key={key}
            style={pillBase}
            title={snapshot.updatedAt ? `Updated ${new Date(snapshot.updatedAt).toLocaleString('en-GB')}` : undefined}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: swatch,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.58rem',
                fontWeight: 800,
                color: key === 'platinum' ? '#fafafa' : '#0f172a',
                letterSpacing: '-0.02em',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
              aria-hidden
            >
              {sym}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, overflow: 'hidden', paddingRight: '0.1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(3.75rem, 1fr)', alignItems: 'baseline', gap: '0.35rem', width: '100%', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: labelColor || 'var(--text-muted)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtSpot(price)}</span>
              </div>
              <div
                style={{
                  marginTop: '0.12rem',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: move ? (move.up ? 'var(--success)' : 'var(--danger)') : error ? 'var(--warning)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {move ? (
                  <>
                    <span>{move.arrow}</span>
                    <span style={{ marginLeft: '0.15rem' }}>{move.rest}</span>
                  </>
                ) : (
                  <span>{metalStatusSubline(snapshot, price, error, key)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
