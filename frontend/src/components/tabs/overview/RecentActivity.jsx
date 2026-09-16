import { EmptyPanel, ErrorPanel, LoadingPanel, Section, fmtDateTime } from './overviewShared'

export default function RecentActivity({ items, loading, error, onRetry }) {
  return (
    <Section title="Recent Activity">
      {loading ? <LoadingPanel label="Loading activity…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyPanel title="No recent activity" message="Task and workflow updates will appear here." />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {items.map((f) => (
            <li key={f.id} className="py-2 min-h-[40px]">
              <p className="text-sm text-gray-800">{f.text}</p>
              <p className="text-[11px] text-gray-500 capitalize">
                {f.dept || 'general'} · {fmtDateTime(f.time)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
