export default function ProductionTimeline({ timeline, selectedBatch }) {
  const steps = timeline || []
  return (
    <section className="pd-panel pd-timeline" aria-label="Production timeline">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Production Timeline</h2>
        <span className="pd-muted">
          {selectedBatch?.batchNumber ? `Batch ${selectedBatch.batchNumber}` : 'No active batches'}
        </span>
      </div>
      <ol className="pd-timeline-track">
        {steps.map((step, i) => (
          <li key={step.key} className={`pd-timeline-step pd-timeline-step--${step.state}`}>
            <div className="pd-timeline-node">
              {step.state === 'done' ? '✓' : i + 1}
            </div>
            <div className="pd-timeline-label">{step.label}</div>
            {i < steps.length - 1 ? <div className="pd-timeline-connector" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
