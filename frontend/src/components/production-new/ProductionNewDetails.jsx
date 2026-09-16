import { formatGrams, formatMinutes } from '../production-control/shared'

function dash(v) {
  if (v == null || v === '') return '—'
  return v
}

export default function ProductionNewDetails({ details }) {
  if (!details) {
    return (
      <section className="prod-new-details" aria-label="Production details">
        <h2 className="prod-new-section-title">Details</h2>
        <p className="prod-new-muted">No data</p>
      </section>
    )
  }

  const items = [
    { label: 'Employees Number', value: dash(details.employeesNumber) },
    { label: 'Floor Manager', value: dash(details.floorManager) },
    { label: 'Which Shift', value: dash(details.shiftName) },
    { label: 'Total Production Today', value: dash(details.totalProductionToday) },
    { label: 'Under Production', value: dash(details.underProduction) },
    {
      label: 'Total Output',
      value: details.totalOutput != null ? formatGrams(details.totalOutput) : '—',
    },
    {
      label: 'Time Comparison',
      value: details.timeComparison
        ? `${formatMinutes(details.timeComparison.elapsedMin)} elapsed · ${formatMinutes(details.timeComparison.remainingMin)} left`
        : '—',
    },
    {
      label: 'Yesterday vs Today',
      value: details.yesterdayVsToday
        ? `Today ${dash(details.yesterdayVsToday.today)} · Yday ${dash(details.yesterdayVsToday.yesterday)}`
        : '—',
    },
    {
      label: 'Weekly Comparison',
      value: details.weeklyComparison?.completed != null || details.weeklyComparison?.jobs != null
        ? `Completed ${dash(details.weeklyComparison.completed)} · Jobs ${dash(details.weeklyComparison.jobs)}`
        : '—',
    },
  ]

  return (
    <section className="prod-new-details" aria-label="Production details">
      <h2 className="prod-new-section-title">Details</h2>
      <div className="prod-new-details-grid">
        {items.map((item) => (
          <div key={item.label} className="prod-new-detail-card">
            <div className="prod-new-detail-label">{item.label}</div>
            <div className="prod-new-detail-value">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
