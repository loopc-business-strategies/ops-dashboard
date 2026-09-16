import { fmtDateTime } from './overviewShared'

export default function OverviewHeader({
  userName,
  lastLogin,
  roleLabel,
  onRefresh,
  onSearch,
  onExceptions,
  refreshing,
  showExceptions,
}) {
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Overview</h1>
        <p className="text-sm text-gray-600 mt-0.5">Workspace summary and operational status</p>
        <p className="text-xs text-gray-500 mt-1">
          {todayLabel}
          {userName ? ` · ${userName}` : ''}
          {roleLabel ? ` · ${roleLabel}` : ''}
          {lastLogin ? ` · Last login ${fmtDateTime(lastLogin)}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button type="button" onClick={onSearch} className="btn btn-secondary btn-sm">
          Search
        </button>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="btn btn-secondary btn-sm">
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        {showExceptions ? (
          <button type="button" onClick={onExceptions} className="btn btn-secondary btn-sm">
            Exceptions
          </button>
        ) : null}
      </div>
    </header>
  )
}
