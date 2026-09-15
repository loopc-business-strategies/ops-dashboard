import {
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  Section,
  STATUS_OPTIONS,
  fmtDate,
  priorityTone,
  statusLabel,
} from './overviewShared'

export default function MyWorkPanel({
  loading,
  error,
  onRetry,
  items,
  taskFilter,
  setTaskFilter,
  canCreateTasks,
  onCreate,
  onOpen,
  onStatusChange,
  canUpdateTask,
  todayStart,
}) {
  return (
    <Section
      title="My Work / Attention Required"
      action={
        <div className="flex flex-wrap gap-2">
          {[
            ['attention', 'Needs attention'],
            ['my', 'Assigned to me'],
            ['overdue', 'Overdue'],
            ['due-today', 'Due today'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTaskFilter(id)}
              className={`h-8 px-2.5 text-xs rounded-lg border ${taskFilter === id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              {label}
            </button>
          ))}
          {canCreateTasks ? (
            <button type="button" onClick={onCreate} className="h-8 px-2.5 text-xs rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900">
              + Create Task
            </button>
          ) : null}
        </div>
      }
    >
      {loading ? <LoadingPanel label="Loading tasks…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyPanel title="You're all caught up." message="No pending tasks need attention right now." />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 8).map((task) => {
            const overdue = task.dueDate && new Date(task.dueDate) < todayStart && task.status !== 'done'
            return (
              <div key={task._id} className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {task.department || 'General'} · {task.assignedTo || 'Unassigned'} · Due {fmtDate(task.dueDate)}
                      {overdue ? ' · Overdue' : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{statusLabel(task.status)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded border ${priorityTone(task.priority)}`}>
                      {(task.priority || 'medium').toUpperCase()}
                    </span>
                    <select
                      disabled={!canUpdateTask(task)}
                      value={task.status}
                      onChange={(e) => onStatusChange(task, e.target.value)}
                      className="input-field text-xs w-32"
                      aria-label={`Status for ${task.title}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => onOpen(task)} className="text-xs text-emerald-800 hover:underline">
                      Open
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </Section>
  )
}
