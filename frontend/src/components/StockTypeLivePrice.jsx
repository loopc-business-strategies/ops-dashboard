import {
  fmtMoveRow,
  fmtSpot,
  formatLiveMetalUnit,
  metalStatusSubline,
} from '../utils/liveMetalRates'

export default function StockTypeLivePrice({
  metalKey,
  snapshot,
  error = null,
  align = 'right',
}) {
  if (!metalKey || !snapshot) return null

  const price = Number(snapshot[metalKey] || 0)
  const move = snapshot.deltas && snapshot.prevSnapshot && !error
    ? fmtMoveRow(snapshot.deltas[metalKey], snapshot.prevSnapshot[metalKey])
    : null
  const unitLabel = formatLiveMetalUnit(snapshot.unit || 'TOZ')
  const currency = String(snapshot.currency || 'USD').trim().toUpperCase() || 'USD'

  return (
    <div
      style={{ display: 'grid', justifyItems: align === 'left' ? 'start' : 'end', gap: '0.12rem', minWidth: 0 }}
      title={snapshot.updatedAt ? `Updated ${new Date(snapshot.updatedAt).toLocaleString('en-GB')}` : undefined}
    >
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: '700',
          color: '#166534',
          background: '#DCFCE7',
          padding: '0.15rem 0.45rem',
          borderRadius: '0.25rem',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtSpot(price)}
        {' '}
        {currency}
        /
        {unitLabel}
      </span>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: '700',
          color: error ? '#B45309' : move ? (move.up ? '#15803D' : '#B91C1C') : '#64748B',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {move ? (
          <>
            <span>{move.arrow}</span>
            <span style={{ marginLeft: '0.15rem' }}>{move.rest}</span>
          </>
        ) : (
          metalStatusSubline(snapshot, price, error, metalKey)
        )}
      </span>
    </div>
  )
}
