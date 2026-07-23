import {
  USE_SEED_DATA,
  StatCard,
  SectionHeader,
  Badge,
  linesForUi,
  STATE_COLORS,
  DEFAULT_WORK_ORDERS,
  DEFAULT_ALERTS,
  DEFAULT_ORDERS,
} from './shared'

// ── KPI Overview ──────────────────────────────────
function KPIOverview() {
  const totalOutput = linesForUi.reduce((s, l) => s + l.output, 0)
  const totalTarget = linesForUi.reduce((s, l) => s + l.target, 0)
  const activeLines = linesForUi.filter((l) => l.state === 'running').length
  const oeePositive = linesForUi.filter((l) => l.oee > 0)
  const avgOEE = oeePositive.length
    ? Math.round(oeePositive.reduce((s, l) => s + l.oee, 0) / oeePositive.length)
    : 0
  const avgQuality = linesForUi.length
    ? (linesForUi.reduce((s, l) => s + l.quality, 0) / linesForUi.length).toFixed(1)
    : '0.0'
  const seedWorkOpen = USE_SEED_DATA ? DEFAULT_WORK_ORDERS.filter((w) => w.status !== 'closed').length : 0
  const seedAlertsOpen = USE_SEED_DATA ? DEFAULT_ALERTS.filter((a) => !a.ack).length : 0
  const seedOrdersActive = USE_SEED_DATA ? DEFAULT_ORDERS.filter((o) => o.status === 'in-progress').length : 0

  return (
    <div className="space-y-6">
      <SectionHeader title="KPI Overview" sub="Real-time status across all production lines" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="🏭" label="Lines Running"    value={`${activeLines}/${linesForUi.length}`} color="#22c55e" trend={0} />
        <StatCard icon="📦" label="Total Output"     value={totalOutput.toLocaleString()} sub={`Target: ${totalTarget.toLocaleString()}`} color="var(--purple)" trend={-4} />
        <StatCard icon="⚡" label="Avg OEE"          value={`${avgOEE}%`}  sub="Overall Equipment Effectiveness" color="#3b82f6" trend={2} />
        <StatCard icon="🎯" label="Quality Rate"     value={`${avgQuality}%`} color="#22c55e" trend={1} />
        <StatCard icon="🔧" label="Open Work Orders" value={seedWorkOpen} color="#eab308" />
      </div>

      {USE_SEED_DATA ? (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon="⚠️" label="Active Alerts"   value={seedAlertsOpen} color="#ef4444" />
        <StatCard icon="📋" label="Active Orders"    value={seedOrdersActive} color="var(--purple)" />
        <StatCard icon="🕐" label="Downtime Today"   value="2h 14m"  sub="Line 2 maintenance" color="#f59e0b" />
        <StatCard icon="📈" label="Efficiency"       value="81.4%" sub="vs 79.2% last week" color="#22c55e" trend={2.8} />
        <StatCard icon="🔄" label="Shift Changes"    value="3"  sub="Next: 14:00" color="#3b82f6" />
      </div>
      ) : (
      <p className="text-sm text-gray-500 px-1">
        Connect production data sources to populate KPIs; demo metrics are hidden outside local seed mode.
      </p>
      )}

      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(17, 24, 39, 0.96)',
          border: '1px solid rgba(55, 65, 81, 0.95)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.02), 0 12px 24px rgba(0, 0, 0, 0.16)',
        }}
      >
        <h4 className="text-sm font-semibold text-white mb-4 leading-tight">Production Line Status</h4>
        <div className="space-y-3">
          {linesForUi.length === 0 ? (
            <p className="text-sm text-gray-400">No line data yet. Enable local demo data with VITE_ENABLE_SEED_DATA=true or connect production feeds.</p>
          ) : (
          linesForUi.map(line => {
            const pct = Math.round((line.output / line.target) * 100)
            const sc  = STATE_COLORS[line.state]
            return (
              <div
                key={line.id}
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(17, 24, 39, 0.92)',
                  border: '1px solid rgba(55, 65, 81, 0.9)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-white leading-tight truncate">{line.name}</span>
                    <Badge color={sc.badge}>{sc.label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400 lg:text-right">
                    <span className="whitespace-nowrap">OEE: <span className="text-white font-medium">{line.oee || '—'}%</span></span>
                    <span className="whitespace-nowrap">Quality: <span className="text-white font-medium">{line.quality}%</span></span>
                    <span className="whitespace-nowrap">Operator: <span className="text-white font-medium">{line.operator}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? '#22c55e' : pct >= 70 ? '#eab308' : '#ef4444' }} />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {line.output.toLocaleString()} / {line.target.toLocaleString()} ({pct}%)
                  </span>
                </div>
              </div>
            )
          })
          )}
        </div>
      </div>
      </div>
   
  )
}

export default KPIOverview
