import HeaderBar from './HeaderBar'
import KpiRow from './KpiRow'
import TimeComparison from './TimeComparison'
import ProductionTimeline from './ProductionTimeline'
import LiveBatchStrip from './LiveBatchStrip'
import MeltingMetalPanel from './MeltingMetalPanel'
import DepartmentOverview from './DepartmentOverview'
import EmployeeRating from './EmployeeRating'
import TotalProcessedStatus from './TotalProcessedStatus'
import { useProductionDashboard } from './useProductionDashboard'
import './ProductionDashboard.css'

export default function ProductionDashboardTab() {
  const {
    loading,
    error,
    model,
    lastUpdated,
    connection,
    refresh,
    ensurePeriod,
    periodLoading,
  } = useProductionDashboard()
  const meltingCard = (model?.liveCards || []).find((c) => c.isMelting) || null

  return (
    <div className="pd-page">
      <HeaderBar
        header={model?.header}
        lastUpdated={lastUpdated}
        connection={connection}
        onRefresh={() => refresh()}
        loading={loading}
      />

      {loading && !model ? (
        <div className="pd-skeleton" aria-busy="true">
          <div className="pd-skel-kpis" />
          <div className="pd-skel-mid" />
          <div className="pd-skel-live" />
        </div>
      ) : null}

      {error && !model ? (
        <div className="pd-error" role="alert">
          <p>{error}</p>
          <button type="button" className="pd-btn pd-btn--primary" onClick={() => refresh()}>Retry</button>
        </div>
      ) : null}

      {error && model ? (
        <p className="pd-banner-warn" role="status">Partial data: {error}</p>
      ) : null}

      {model ? (
        <div className="pd-layout">
          <KpiRow model={model} />
          <div className="pd-row-mid">
            <TimeComparison
              comparisons={model.comparisons}
              onNeedPeriod={ensurePeriod}
              periodLoading={periodLoading}
            />
            <ProductionTimeline timeline={model.timeline} selectedBatch={model.selectedBatch} />
          </div>
          <div className="pd-row-live">
            <LiveBatchStrip cards={model.liveCards} />
            {meltingCard ? (
              <MeltingMetalPanel
                meltingCard={meltingCard}
                permissions={model.permissions}
                onDone={() => refresh()}
              />
            ) : null}
          </div>
          <div className="pd-row-bottom">
            <DepartmentOverview rows={model.deptRows} />
            <EmployeeRating rows={model.employeeRatings} />
            <TotalProcessedStatus
              totalsByPeriod={model.totalsByPeriod}
              statusSummary={model.statusSummary}
              onNeedPeriod={ensurePeriod}
              periodLoading={periodLoading}
            />
          </div>
        </div>
      ) : null}

      {!loading && !error && !model ? (
        <p className="pd-empty pd-empty--page">No production activity today</p>
      ) : null}
    </div>
  )
}
