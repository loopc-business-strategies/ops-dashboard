import { formatGrams, formatMinutes, formatPct, formatShiftClock, formatEmployeeRange } from './formatters'

function KpiCard({ title, children }) {
  return (
    <article className="pd-kpi-card">
      <h3 className="pd-kpi-title">{title}</h3>
      <div className="pd-kpi-body">{children}</div>
    </article>
  )
}

function Row({ label, value }) {
  return (
    <div className="pd-kpi-row">
      <span className="pd-kpi-label">{label}</span>
      <span className="pd-kpi-value">{value}</span>
    </div>
  )
}

export default function KpiRow({ model }) {
  if (!model) return null
  const { employeeKpi, shiftKpi, productionTodayKpi, outputKpi, underProductionKpi } = model

  return (
    <section className="pd-kpi-row-grid" aria-label="Production KPIs">
      <KpiCard title="Employee">
        <Row label="Total Employees" value={employeeKpi?.total != null ? employeeKpi.total : '—'} />
        <Row label="Active Employees" value={employeeKpi?.active != null ? employeeKpi.active : '—'} />
        <div className="pd-kpi-block">
          <span className="pd-kpi-label">Employee No</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{formatEmployeeRange(employeeKpi?.idRange)}</span>
        </div>
        <div className="pd-kpi-block">
          <span className="pd-kpi-label">Employee</span>
          <span className="pd-kpi-value pd-kpi-value--sm">
            {employeeKpi?.active != null ? `${employeeKpi.active} active` : '—'}
          </span>
        </div>
        <div className="pd-kpi-block">
          <span className="pd-kpi-label">Floor Manager</span>
          <span className="pd-kpi-value pd-kpi-value--sm">{employeeKpi?.floorManager || 'Manager not assigned'}</span>
        </div>
      </KpiCard>

      <KpiCard title="Shift">
        <div className="pd-kpi-hero">{shiftKpi?.name || '—'}</div>
        <div className="pd-kpi-sub">
          {shiftKpi?.startTime ? `${formatShiftClock(shiftKpi.startTime)} — ${formatShiftClock(shiftKpi.endTime)}` : '—'}
        </div>
        <div className="pd-progress">
          <div
            className={`pd-progress-bar${shiftKpi?.progress == null ? ' pd-progress-bar--indet' : ''}`}
            style={shiftKpi?.progress != null ? { width: `${shiftKpi.progress}%` } : undefined}
          />
        </div>
        <Row label="Progress" value={shiftKpi?.progress != null ? formatPct(shiftKpi.progress) : '—'} />
        <Row label="Floor Manager" value={shiftKpi?.floorManager || 'Manager not assigned'} />
      </KpiCard>

      <KpiCard title="Total Production Today">
        <Row
          label="Processed Qty"
          value={productionTodayKpi?.processedQty != null ? formatGrams(productionTodayKpi.processedQty) : 'No production data'}
        />
        <Row
          label="Production Weight"
          value={productionTodayKpi?.productionWeight != null ? formatGrams(productionTodayKpi.productionWeight) : '—'}
        />
        <Row
          label="Completed Batches"
          value={
            productionTodayKpi?.completedBatches != null
              ? `${productionTodayKpi.completedBatches} / ${productionTodayKpi.totalBatches ?? '—'}`
              : '—'
          }
        />
      </KpiCard>

      <KpiCard title="Total Output">
        <Row label="Input Weight" value={outputKpi?.inputWeight != null ? formatGrams(outputKpi.inputWeight) : 'Weight pending'} />
        <Row label="Output Weight" value={outputKpi?.outputWeight != null ? formatGrams(outputKpi.outputWeight) : 'Weight pending'} />
        <Row label="Output Quantity" value={outputKpi?.outputQuantity != null ? formatGrams(outputKpi.outputQuantity) : '—'} />
        <Row label="Completion" value={outputKpi?.completion != null ? formatPct(outputKpi.completion) : '—'} />
      </KpiCard>

      <KpiCard title="Under Production">
        <Row
          label="Active Batches"
          value={underProductionKpi?.activeBatches != null ? underProductionKpi.activeBatches : 'No active batches'}
        />
        <Row
          label="Pending Quantity"
          value={underProductionKpi?.pendingQuantity != null ? underProductionKpi.pendingQuantity : '—'}
        />
        <Row
          label="Remaining Weight"
          value={underProductionKpi?.remainingWeight != null ? formatGrams(underProductionKpi.remainingWeight) : 'Weight pending'}
        />
        <Row
          label="Estimated Completion"
          value={
            underProductionKpi?.estimatedCompletion != null
              ? formatMinutes(underProductionKpi.estimatedCompletion)
              : 'Estimation unavailable'
          }
        />
      </KpiCard>
    </section>
  )
}
