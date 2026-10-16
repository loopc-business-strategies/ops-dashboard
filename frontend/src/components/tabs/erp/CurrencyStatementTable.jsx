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
  if (kind === 'total') return '#B6D7A8'
  if (kind === 'subtotal' || kind === 'result') return '#D9EAD3'
  if (kind === 'section' || kind === 'group') return '#E8F0E4'
  return 'transparent'
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
    })
  })
  return map
}

export default function CurrencyStatementTable({
  model,
  moneyColumns,
  showMetal = false,
  metaByKey,
  onOpenAccount,
  actionLabel = 'Ledger',
}) {
  if (!model?.body?.length) return null
  const visible = new Set(visibleMoneyIndexes(moneyColumns))
  const pairs = PAIR_DEFS
    .map((pair) => ({
      title: model.pdfHead[0][pair.titleIndex]?.content || '',
      indexes: pair.indexes.filter((index) => visible.has(index)),
    }))
    .filter((pair) => pair.indexes.length)
  return (
    <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
      <thead>
        <tr>
          <th rowSpan={2} style={{ textAlign: 'left' }}>Account Head</th>
          <th rowSpan={2} style={{ textAlign: 'left' }}>Code</th>
          <th rowSpan={2}>Division</th>
          {pairs.map((pair) => (
            <th key={pair.title} colSpan={pair.indexes.length} style={{ textAlign: 'center' }}>{pair.title}</th>
          ))}
          {showMetal && <th rowSpan={2} className="num">Gold g</th>}
          {showMetal && <th rowSpan={2} className="num">Silver g</th>}
          {onOpenAccount && <th rowSpan={2}>Action</th>}
        </tr>
        <tr>
          {pairs.flatMap((pair) => pair.indexes.map((index) => (
            <th key={`${pair.title}-${index}`} className="num">{index % 2 === 1 ? 'Debit' : 'Credit'}</th>
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
              <td>
                {cells[0]}
                {meta?.isActive === false ? <span style={{ marginLeft: '0.35rem', color: '#64748B', fontSize: '0.75rem' }}>Closed</span> : null}
              </td>
              <td>{cells[1]}</td>
              <td>{cells[2]}</td>
              {pairs.flatMap((pair) => pair.indexes.map((index) => (
                <td key={index} style={{ textAlign: 'right' }}>{cells[index]}</td>
              )))}
              {showMetal && <td style={{ textAlign: 'right' }}>{meta?.goldText || ''}</td>}
              {showMetal && <td style={{ textAlign: 'right' }}>{meta?.silverText || ''}</td>}
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
