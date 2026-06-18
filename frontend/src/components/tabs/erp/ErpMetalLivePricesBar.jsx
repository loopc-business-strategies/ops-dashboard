import useLiveMetalRates from '../../../hooks/useLiveMetalRates'
import {
  fmtMoveRow,
  fmtSpot,
  formatLiveMetalSourceLabel,
  formatLiveMetalUnit,
  isMt4BridgeRates,
  metalErrorLabel,
  metalStatusSubline,
} from '../../../utils/liveMetalRates'

const METALS = [
  { key: 'gold', label: 'Gold', swatch: '#FACC15', sym: 'Au' },
  { key: 'silver', label: 'Silver', swatch: '#CBD5E1', sym: 'Ag' },
  { key: 'platinum', label: 'Platinum', swatch: '#A855F7', sym: 'Pt' },
]

/**
 * Live MT4 metal prices strip for ERP sub-tabs (light theme).
 */
export default function ErpMetalLivePricesBar() {
  const { snapshot, error } = useLiveMetalRates()
  const feedLabel = formatLiveMetalSourceLabel(snapshot.source)
  const isMt4 = isMt4BridgeRates(snapshot)
  const updatedLabel = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div
      style={{
        marginBottom: '0.85rem',
        padding: '0.65rem 0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #BFD0E5',
        background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1E3A8A', letterSpacing: '0.03em' }}>
          LIVE SPOT PRICES
        </p>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
          {error
            ? metalErrorLabel(error) || 'Feed unavailable'
            : isMt4 && updatedLabel
              ? `MT4 live · updated ${updatedLabel}`
              : feedLabel && updatedLabel
                ? `${feedLabel} · updated ${updatedLabel}`
                : 'Waiting for live feed…'}
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
        {METALS.map(({ key, label, swatch, sym }) => {
          const price = snapshot[key]
          const move = snapshot.deltas && snapshot.prevSnapshot && !error
            ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
            : null

          return (
            <div
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.4rem 0.65rem 0.4rem 0.5rem',
                borderRadius: '0.45rem',
                background: '#FFFFFF',
                border: '1px solid #D1D5DB',
                minWidth: '8.5rem',
                flex: '1 1 8.5rem',
                maxWidth: '12rem',
              }}
              title={snapshot.updatedAt ? `Updated ${new Date(snapshot.updatedAt).toLocaleString('en-GB')}` : undefined}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: swatch,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  color: key === 'platinum' ? '#fafafa' : '#0f172a',
                }}
                aria-hidden
              >
                {sym}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>{label}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtSpot(price)}</span>
                </div>
                <div
                  style={{
                    marginTop: '0.1rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: error ? '#D97706' : move ? (move.up ? '#059669' : '#DC2626') : '#94A3B8',
                    whiteSpace: 'nowrap',
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
      <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748B' }}>
        {`Prices in ${snapshot.currency || 'USD'}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')}. Equity and margin columns update as spot moves.`}
      </p>
    </div>
  )
}
