import { StatCard, SectionHeader } from './shared'

function CostTracking({ canViewCosts }) {
  if (!canViewCosts) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
          style={{ background: 'rgba(var(--purple-rgb),0.1)' }}
        >
          🔒
        </div>
        <h3 className="text-base font-semibold text-white mb-2">Access Restricted</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Cost tracking is available to Finance, Management, and Admin roles only.
          Contact your administrator if you need access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Cost Tracking" sub="Budget vs. actual from connected finance/production sources" />
      <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-10 text-center">
        <p className="text-sm font-medium text-white">No cost data available</p>
        <p className="text-xs text-gray-500 mt-1">Connect cost feeds to populate budget vs actual tracking.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60">
        <StatCard icon="📊" label="Total Budget" value="—" color="var(--purple)" />
        <StatCard icon="💵" label="Total Actual" value="—" color="#22c55e" />
        <StatCard icon="📉" label="Variance" value="—" color="#22c55e" />
      </div>
    </div>
  )
}

export default CostTracking
