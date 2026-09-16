import { formatGrams, formatMinutes, formatTime } from '../production-control/shared'

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('complet') || s.includes('over')) return 'ok'
  if (s.includes('delay') || s.includes('hold')) return 'warn'
  if (s.includes('progress') || s.includes('process') || s.includes('load') || s.includes('start')) return 'info'
  if (s.includes('no data') || s.includes('not started')) return 'muted'
  return 'neutral'
}

function Row({ label, value }) {
  return (
    <div className="prod-new-card-row">
      <span className="prod-new-card-k">{label}</span>
      <span className="prod-new-card-v">{value ?? '—'}</span>
    </div>
  )
}

export default function ProductionNewDeptCard({ card }) {
  if (!card) return null
  const tone = statusClass(card.productionStatus)

  return (
    <article className="prod-new-dept-card" aria-label={card.name}>
      <header className="prod-new-dept-card-head">
        <h3 className="prod-new-dept-name">{card.name}</h3>
        <span className={`prod-new-status prod-new-status-${tone}`}>{card.productionStatus || 'No Data'}</span>
      </header>

      <div className="prod-new-dept-card-body">
        <Row label="Quantity" value={card.quantity != null ? formatGrams(card.quantity) : '—'} />
        <Row label="Batch" value={card.batchNumber} />
        <Row label="Employee" value={card.employee} />
        <Row label="Time Taken" value={formatMinutes(card.timeTakenMin)} />
        <Row label="Time Per Batch" value={formatMinutes(card.timePerBatchMin)} />
        {card.key === 'melting' ? (
          <Row label="Melting Time" value={formatMinutes(card.meltingTimeMin)} />
        ) : null}
        <Row label="Employee Rating" value={card.employeeRating} />
        <Row label="Metal Loss" value={card.metalLoss != null ? formatGrams(card.metalLoss) : '—'} />
        <Row label="Total Processed" value={card.totalProcessed != null ? formatGrams(card.totalProcessed) : '—'} />
        <Row label="Batch Start" value={card.batchStarted ? (formatTime(card.startedAt) || 'Started') : '—'} />
        <Row label="Batch Over" value={card.batchOver ? 'Yes' : '—'} />
        <Row label="Loading Status" value={card.loadingStatus} />
        <Row label="Metal In" value={card.metalIn != null ? formatGrams(card.metalIn) : '—'} />
        <Row label="Metal Out" value={card.metalOut != null ? formatGrams(card.metalOut) : '—'} />
        <Row label="FM Confirm (Metal Out)" value={card.floorManagerConfirm} />
      </div>
    </article>
  )
}
