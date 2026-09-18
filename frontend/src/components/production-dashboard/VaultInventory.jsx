import { formatGrams } from './formatters'

export default function VaultInventory({
  lines = [],
  onIssueMetal,
  canIssue,
}) {
  return (
    <section className="pd-panel pd-vault-inventory" aria-label="Vault inventory">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Vault Inventory</h2>
        <button
          type="button"
          className="pd-btn pd-btn--sm pd-btn--primary"
          onClick={() => onIssueMetal?.()}
          disabled={!canIssue}
          title={canIssue ? 'Issue metal from vault' : 'No issue permission'}
        >
          + Issue Metal
        </button>
      </div>
      <ul className="pd-vault-list">
        {(lines || []).map((line) => (
          <li key={line.id} className="pd-vault-line">
            <div>
              <strong>{line.label}</strong>
              <span className="pd-muted">
                {line.metalType}
                {line.purity ? ` · ${line.purity}` : ''}
              </span>
            </div>
            <strong className="pd-vault-weight">{line.weight != null ? formatGrams(line.weight) : '—'}</strong>
          </li>
        ))}
      </ul>
      {!lines?.length ? <p className="pd-empty">No vault stock (ERP purchase lots appear here)</p> : null}
    </section>
  )
}
