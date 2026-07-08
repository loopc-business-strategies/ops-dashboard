const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

const FIELDS = [
  { key: 'no', label: 'No. column' },
  { key: 'description', label: 'Description column' },
  { key: 'type', label: 'Type column' },
  { key: 'amountFc', label: 'Amount FC column' },
  { key: 'amountLc', label: 'Amount column' },
]

export default function VoucherTableHeaderEditor({ tableHeaders = {}, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {FIELDS.map(({ key, label }) => (
        <label key={key} style={{ fontSize: 12, color: '#6B7280' }}>
          {label}
          <input
            type="text"
            value={tableHeaders[key] || ''}
            onChange={(e) => onChange({ ...tableHeaders, [key]: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
      ))}
    </div>
  )
}
