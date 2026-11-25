import { resolveVisibleTrialMetalKinds, TRIAL_METAL_KIND_DEFS } from './reportDisplayOptions'

const PAIR_DEFS = [
  { titleIndex: 3, indexes: [3, 4] },
  { titleIndex: 4, indexes: [5, 6] },
  { titleIndex: 5, indexes: [7, 8] },
]

function visibleMoneyIndexes(moneyColumns) {
  if (moneyColumns?.debit === false && moneyColumns?.credit === false) return [7, 8]
  if (moneyColumns?.net === false) return [3, 4, 5, 6]
  return [3, 4, 5, 6, 7, 8]
}

function rowFill(kind) {
  if (kind === 'total') return 'rgba(var(--brand-rgb), 0.28)'
  if (kind === 'subtotal' || kind === 'result') return 'rgba(var(--brand-rgb), 0.16)'
  if (kind === 'section' || kind === 'group') return 'rgba(var(--brand-rgb), 0.08)'
  return 'transparent'
}

const METAL_TEXT_KEY = {
  gold: 'goldText',
  silver: 'silverText',
  platinum: 'platinumText',
  alloy: 'alloyText',
}

const MONEY_CELL_STYLE = {
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'Consolas, "Courier New", monospace',
  minWidth: '6.5rem',
  boxSizing: 'border-box',
}

const TEXT_CELL_STYLE = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  maxWidth: '16rem',
  boxSizing: 'border-box',
}

export function currencyRowMetaMap(rows = [], formatGrams) {
  const map = new Map()
  rows.forEach((row) => {
    const key = String(row?.accountCode || row?.accountName || '')
    if (!key) return
    map.set(key, {
      ...row,
      goldText: formatGrams ? formatGrams(row.goldNet) : '',
      silverText: formatGrams ? formatGrams(row.silverNet) : '',
      platinumText: formatGrams ? formatGrams(row.platinumNet) : '',
      alloyText: formatGrams ? formatGrams(row.alloyNet) : '',
    })
  })
  return map
}

export default function CurrencyStatementTable({
  model,
  moneyColumns,
  showMetal = false,
  metalType = '',
  metaByKey,
  onOpenAccount,
  actionLabel = 'Ledger',
}) {
  if (!model?.body?.length) return null
  const visible = new Set(visibleMoneyIndexes(moneyColumns))
  const metalKinds = showMetal ? resolveVisibleTrialMetalKinds(metalType) : []
  const metalDefs = TRIAL_METAL_KIND_DEFS.filter((def) => metalKinds.includes(def.kind))
  const pairs = PAIR_DEFS
    .map((pair) => ({
      title: model.pdfHead[0][pair.titleIndex]?.content || '',
      indexes: pair.indexes.filter((index) => visible.has(index)),
    }))
    .filter((pair) => pair.indexes.length)
  const moneyColCount = pairs.reduce((sum, pair) => sum + pair.indexes.length, 0)
  const minWidthPx = 280 + moneyColCount * 110 + metalDefs.length * 80 + (onOpenAccount ? 88 : 0)
  return (
    <table
      className="erp-table erp-statement-table"
      style={{
        width: '100%',
        minWidth: `${minWidthPx}px`,
        borderCollapse: 'collapse',
        fontSize: '0.82rem',
        tableLayout: 'auto',
      }}
    >
      <thead>
        <tr>
          <th rowSpan={2} style={{ textAlign: 'left', minWidth: '9rem' }}>Account Head</th>
          <th rowSpan={2} style={{ textAlign: 'left', minWidth: '4.5rem' }}>Code</th>
          <th rowSpan={2} style={{ minWidth: '4rem' }}>Division</th>
          {pairs.map((pair) => (
            <th key={pair.title} colSpan={pair.indexes.length} style={{ textAlign: 'center' }}>{pair.title}</th>
          ))}
          {metalDefs.map((def) => (
            <th key={def.kind} rowSpan={2} className="num" style={{ minWidth: '4.5rem' }}>{def.header}</th>
          ))}
          {onOpenAccount && <th rowSpan={2} style={{ minWidth: '5rem' }}>Action</th>}
        </tr>
        <tr>
          {pairs.flatMap((pair) => pair.indexes.map((index) => (
            <th key={`${pair.title}-${index}`} className="num" style={{ minWidth: '6.5rem' }}>{index % 2 === 1 ? 'Debit' : 'Credit'}</th>
          )))}
        </tr>
      </thead>
      <tbody>
        {model.body.map((cells, rowIndex) => {
          const kind = model.kinds[rowIndex]
          const metaKey = String(cells[1] || cells[0] || '')
          const meta = metaByKey?.get(metaKey)
          const bold = kind && kind !== 'account'
          return (
            <tr key={`${kind}-${metaKey}-${rowIndex}`} style={{ background: rowFill(kind), fontWeight: bold ? '700' : '500' }}>
              <td style={TEXT_CELL_STYLE}>
                {cells[0]}
                {meta?.isActive === false ? <span style={{ marginLeft: '0.35rem', color: '#64748B', fontSize: '0.75rem' }}>Closed</span> : null}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{cells[1]}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{cells[2]}</td>
              {pairs.flatMap((pair) => pair.indexes.map((index) => (
                <td key={index} className="num" style={MONEY_CELL_STYLE} title={cells[index] || undefined}>{cells[index]}</td>
              )))}
              {metalDefs.map((def) => (
                <td key={def.kind} className="num" style={MONEY_CELL_STYLE}>{meta?.[METAL_TEXT_KEY[def.kind]] || ''}</td>
              ))}
              {onOpenAccount && (
                <td>
                  {kind === 'account' && meta?.unposted ? (
                    <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Not posted</span>
                  ) : null}
                  {kind === 'account' && meta && !meta.unposted ? (
                    <button
                      type="button"
                      onClick={() => onOpenAccount(meta)}
                      style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', color: '#0C4A6E', background: '#E0F2FE', cursor: 'pointer' }}
                    >
                      {actionLabel}
                    </button>
                  ) : null}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
