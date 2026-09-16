import { EmptyPanel, ErrorPanel, LoadingPanel, Section } from './overviewShared'

export default function AttendanceSummary({
  loading,
  error,
  onRetry,
  myAttendance,
  attendanceSummaryApi,
  pendingLeaveCount,
  onApplyLeave,
  onViewHr,
}) {
  const hasData = Boolean(myAttendance || attendanceSummaryApi)

  return (
    <Section
      title="Attendance & Leave"
      action={
        <>
          <button type="button" onClick={onApplyLeave} className="btn btn-primary btn-sm">
            Apply for Leave
          </button>
          <button type="button" onClick={onViewHr} className="h-8 px-2.5 text-xs text-gray-700 hover:underline">
            View HR →
          </button>
        </>
      }
    >
      {loading && !hasData ? <LoadingPanel label="Loading attendance…" /> : null}
      {error && !hasData ? <ErrorPanel onRetry={onRetry} /> : null}
      {!loading && !error && !hasData ? (
        <EmptyPanel title="No attendance data" message="Your attendance summary is not available yet." />
      ) : null}
      {hasData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Today</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {myAttendance?.todayStatus ? String(myAttendance.todayStatus).toUpperCase() : '—'}
              {myAttendance?.todayCheckIn ? ` · ${myAttendance.todayCheckIn}` : ''}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">This month</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {myAttendance?.presentDays ?? '—'}
              {myAttendance?.totalDays != null ? `/${myAttendance.totalDays}` : ''} days
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Team present</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {attendanceSummaryApi
                ? `${attendanceSummaryApi.present ?? 0}/${attendanceSummaryApi.total ?? 0}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Pending leave</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{pendingLeaveCount}</p>
          </div>
        </div>
      ) : null}
    </Section>
  )
}
