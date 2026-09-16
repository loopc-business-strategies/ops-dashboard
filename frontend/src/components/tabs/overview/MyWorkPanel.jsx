import {
  EmptyPanel,
  ErrorPanel,
  FilterChip,
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
      title="My Work"
      action={
        <>
          {[
            ['attention', 'Needs attention'],
            ['my', 'Assigned to me'],
            ['overdue', 'Overdue'],
            ['due-today', 'Due today'],
          ].map(([id, label]) => (
            <FilterChip key={id} active={taskFilter === id} onClick={() => setTaskFilter(id)}>
              {label}
            </FilterChip>
          ))}
          {canCreateTasks ? (
            <button type="button" onClick={onCreate} className="btn btn-primary btn-sm">
              Add Task
            </button>
          ) : null}
        </>
      }
    >
      {loading ? <LoadingPanel label="Loading tasks…" /> : null}
      {!loading && error ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyPanel title="No tasks require your attention right now." />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {items.slice(0, 8).map((task) => {
            const overdue = task.dueDate && new Date(task.dueDate) < todayStart && task.status !== 'done'
            return (
              <li key={task._id} className="flex items-center gap-3 py-2 min-h-[44px]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {task.assignedTo || 'Unassigned'}
                    {task.dueDate ? ` · ${fmtDate(task.dueDate)}` : ''}
                    {overdue ? ' · Overdue' : ''}
                    {` · ${statusLabel(task.status)}`}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${priorityTone(task.priority)}`}>
                  {(task.priority || 'medium').toUpperCase()}
                </span>
                <select
                  disabled={!canUpdateTask(task)}
                  value={task.status}
                  onChange={(e) => onStatusChange(task, e.target.value)}
                  className="input-field text-xs w-28 h-8 py-0 shrink-0"
                  aria-label={`Status for ${task.title}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => onOpen(task)} className="text-xs text-gray-700 hover:underline shrink-0">
                  Open
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Section>
  )
}
