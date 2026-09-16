import { EmptyPanel, ErrorPanel, LoadingPanel, Section, getSeverityTone } from './overviewShared'

export default function AttentionRequired({
  loading,
  error,
  onRetry,
  rows,
  ackedAlerts,
  onAcknowledge,
  onViewAll,
}) {
  return (
    <Section
      title="Attention Required"
      action={onViewAll ? (
        <button type="button" onClick={onViewAll} className="h-8 px-2.5 text-xs text-gray-700 hover:underline">
          View all →
        </button>
      ) : null}
    >
      {loading ? <LoadingPanel label="Loading alerts…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyPanel title="No active alerts" message="Exceptions and overdue tasks will appear here." />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 min-h-[44px]">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{a.text}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {a.dept}{a.age ? ` · ${a.age}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!ackedAlerts[a.id] ? (
                  <button type="button" onClick={() => onAcknowledge(a.id)} className="btn btn-ghost btn-sm">
                    Acknowledge
                  </button>
                ) : null}
                <span className={`px-2 py-0.5 rounded border text-[11px] uppercase ${getSeverityTone(a.severity)}`}>
                  {ackedAlerts[a.id] ? 'acked' : a.severity}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
