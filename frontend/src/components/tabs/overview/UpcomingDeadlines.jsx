import { EmptyPanel, ErrorPanel, LoadingPanel, Section } from './overviewShared'

export default function UpcomingDeadlines({ loading, error, onRetry, rows }) {
  return (
    <Section title="Upcoming Deadlines">
      {loading ? <LoadingPanel label="Loading deadlines…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyPanel title="No upcoming deadlines" message="Tasks with due dates will appear here." />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 min-h-[40px]">
              <p className="text-sm text-gray-800 min-w-0 truncate">
                <span className="text-gray-500">{d.when}</span>
                {' · '}
                {d.text}
              </p>
              <span className="text-xs text-gray-500 capitalize shrink-0">{d.dept}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
