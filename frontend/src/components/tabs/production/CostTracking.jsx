import { USE_SEED_DATA, StatCard, SectionHeader, COST_DATA } from './shared'

// ── Cost Tracking ─────────────────────────────────
function CostTracking({ canViewCosts }) {
  if (!canViewCosts) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
             style={{ background: 'rgba(var(--purple-rgb),0.1)' }}>🔒</div>
        <h3 className="text-base font-semibold text-white mb-2">Access Restricted</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Cost tracking is available to Finance, Management, and Admin roles only.
          Contact your administrator if you need access.
        </p>
      </div>
    )
  }

  const costRows = USE_SEED_DATA ? COST_DATA : []
  const totalBudget = costRows.reduce((s, c) => s + c.budget, 0)
  const totalActual = costRows.reduce((s, c) => s + c.actual, 0)
  const totalVar = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <SectionHeader title="Cost Tracking" sub={USE_SEED_DATA ? 'April 2026 — Budget vs. Actual' : 'Budget vs. actual (connect data)'} />

      {!USE_SEED_DATA ? (
        <p className="text-sm text-gray-500">No cost data loaded. Demo cost rows are available only with VITE_ENABLE_SEED_DATA=true in local dev.</p>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon="📊" label="Total Budget"  value={`$${(totalBudget/1000).toFixed(0)}K`} color="var(--purple)" />
        <StatCard icon="💵" label="Total Actual"  value={`$${(totalActual/1000).toFixed(0)}K`} color={totalActual > totalBudget ? '#ef4444' : '#22c55e'} />
        <StatCard icon="📉" label="Variance"      value={`${parseFloat(totalVar) >= 0 ? '+' : ''}${totalVar}%`} color={parseFloat(totalVar) > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Budget Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/30">
              {['Category', 'Budget', 'Actual', 'Variance', 'Usage'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {costRows.map(c => {
              const varPct = c.variance
              const usagePct = Math.round((c.actual / c.budget) * 100)
              return (
                <tr key={c.category} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-white">{c.category}</td>
                  <td className="px-5 py-3.5 text-gray-400">${c.budget.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-white">${c.actual.toLocaleString()}</td>
                  <td className={`px-5 py-3.5 font-medium ${varPct > 5 ? 'text-red-400' : varPct < -3 ? 'text-green-400' : 'text-gray-400'}`}>
                    {varPct > 0 ? '+' : ''}{varPct}%
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                             style={{ width: `${Math.min(100, usagePct)}%`,
                                      background: usagePct > 105 ? '#ef4444' : usagePct > 95 ? '#eab308' : '#22c55e' }} />
                      </div>
                      <span className="text-xs text-gray-400">{usagePct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/20">
              <td className="px-5 py-3.5 font-semibold text-white">Total</td>
              <td className="px-5 py-3.5 font-semibold text-gray-300">${totalBudget.toLocaleString()}</td>
              <td className="px-5 py-3.5 font-semibold text-white">${totalActual.toLocaleString()}</td>
              <td className={`px-5 py-3.5 font-semibold ${parseFloat(totalVar) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {parseFloat(totalVar) >= 0 ? '+' : ''}{totalVar}%
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                         style={{ width: `${Math.min(100, Math.round((totalActual / totalBudget) * 100))}%`,
                                  background: totalActual > totalBudget ? '#ef4444' : '#22c55e' }} />
                  </div>
                  <span className="text-xs text-gray-400">{Math.round((totalActual / totalBudget) * 100)}%</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cost Per Unit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { product: 'Gold Bar 99.99%', cost: '$18.40', target: '$17.50', variance: '+5.1%', bad: true },
          { product: 'Silver Grain 99.9%', cost: '$2.14', target: '$2.20', variance: '-2.7%', bad: false },
          { product: 'Alloy Rod 14K', cost: '$4.82', target: '$5.00', variance: '-3.6%', bad: false },
          { product: 'Ring Blank Set', cost: '$9.15', target: '$8.90', variance: '+2.8%', bad: true },
        ].map(item => (
          <div key={item.product} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-1">{item.product}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Cost/Unit</p>
                <p className="text-lg font-bold text-white">{item.cost}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-sm text-gray-400">{item.target}</p>
              </div>
              <span className={`text-sm font-semibold ${item.bad ? 'text-red-400' : 'text-green-400'}`}>{item.variance}</span>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}

export default CostTracking
