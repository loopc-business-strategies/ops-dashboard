/** "Net Amt (USD) | Net Amt (UZS)" strip for printed vouchers; hidden unless there is a second currency. */
export default function VoucherPrintNetAmounts({ rows = [], fmt, border = '1px solid #111827', fontSize = '11px' }) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize, margin: '0 0 8px' }}>
      <tbody>
        <tr>
          {rows.map((row) => (
            <td key={row.code} style={{ border, padding: '5px 8px', fontWeight: '900', whiteSpace: 'nowrap' }}>
              {`Net Amt (${row.code}) : `}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(row.amount, row.code)}</span>
              {row.rateNote ? <span style={{ fontWeight: '400', fontSize: '0.85em', marginLeft: '6px' }}>{row.rateNote}</span> : null}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
