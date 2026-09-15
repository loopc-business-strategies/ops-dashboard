import { EmptyPanel, ErrorPanel, LoadingPanel, Section } from './overviewShared'

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
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['task', 'Tasks'],
            ['message', 'Messages'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`h-8 px-2.5 text-xs rounded-lg border ${filter === id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={onViewAll} className="h-8 px-2.5 text-xs text-emerald-800 hover:underline">
            View all →
          </button>
        </div>
      }
    >
      {loading ? <LoadingPanel label="Loading notifications…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyPanel title="No notifications" message="New tasks and messages will appear here." />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="space-y-2">
          {rows.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenItem?.(item)}
              className="w-full text-left border border-gray-200 rounded-xl p-3 bg-white hover:border-gray-300"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${item.type === 'task' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-blue-300 bg-blue-50 text-blue-900'}`}>
                  {item.type}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.text}</p>
              <p className="text-[11px] text-gray-500 mt-2">{String(item.time)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </Section>
  )
}
