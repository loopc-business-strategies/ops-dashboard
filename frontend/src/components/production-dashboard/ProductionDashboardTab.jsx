import HeaderBar from './HeaderBar'
import KpiRow from './KpiRow'
import DepartmentOverview from './DepartmentOverview'
import MaterialFlowPanel from './MaterialFlowPanel'
import BatchMonitorTable from './BatchMonitorTable'
import AlertsPanel from './AlertsPanel'
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
    stockLedger,
    stockLedgerLoading,
  } = useProductionDashboard()

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
        <div className="pd-layout pd-layout--reference">
          <KpiRow model={model} />
          <DepartmentOverview cards={model.deptCards} assemblyTables={model.assemblyTables} />
          <MaterialFlowPanel
            materialFlow={model.materialFlow}
            stockSummary={model.stockSummary}
            stockLedger={stockLedger}
            stockLedgerLoading={stockLedgerLoading}
          />
          <div className="pd-row-bottom-split">
            <BatchMonitorTable rows={model.batchMonitorRows} />
            <AlertsPanel alerts={model.alertItems} />
          </div>
        </div>
      ) : null}

      {!loading && !error && !model ? (
        <p className="pd-empty pd-empty--page">No production activity today</p>
      ) : null}
    </div>
  )
}
