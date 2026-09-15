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
  return (
    <header className="relative overflow-hidden bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 right-0 h-0.5" style={{ background: 'var(--brand-primary)' }} />
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-sm text-gray-600 mt-1">ERP operational workspace</p>
          <p className="text-sm text-gray-800 mt-3">
            Good day, <span className="font-medium">{userName || 'User'}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {lastLogin ? `Last login: ${fmtDateTime(lastLogin)}` : 'Last login unavailable'}
            {roleLabel ? ` · ${roleLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-10 px-3.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-800 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="h-10 px-3.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-800"
          >
            Search
          </button>
          {showExceptions ? (
            <button
              type="button"
              onClick={onExceptions}
              className="h-10 px-3.5 text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-900"
            >
              Exceptions
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
