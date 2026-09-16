import { EmptyPanel, ErrorPanel, FilterChip, LoadingPanel, Section, initials } from './overviewShared'

export default function NotificationsPanel({
  loading,
  error,
  onRetry,
  filter,
  setFilter,
  rows,
  onViewAll,
  onOpenItem,
}) {
  return (
    <Section
      title="Notifications & Messages"
      action={
        <>
          {[
            ['all', 'All'],
            ['task', 'Tasks'],
            ['message', 'Messages'],
          ].map(([id, label]) => (
            <FilterChip key={id} active={filter === id} onClick={() => setFilter(id)}>
              {label}
            </FilterChip>
          ))}
          <button type="button" onClick={onViewAll} className="h-8 px-2.5 text-xs text-gray-700 hover:underline">
            View all →
          </button>
        </>
      }
    >
      {loading ? <LoadingPanel label="Loading notifications…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyPanel title="No notifications" message="New tasks and messages will appear here." />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {rows.slice(0, 6).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenItem?.(item)}
                className="w-full text-left flex items-start gap-3 py-2 min-h-[44px] hover:bg-gray-50 rounded-md px-1"
              >
                <span className="mt-0.5 w-7 h-7 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-700 flex items-center justify-center shrink-0">
                  {initials(item.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">{String(item.time)}</span>
                  </span>
                  <span className="block text-xs text-gray-600 truncate">{item.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
