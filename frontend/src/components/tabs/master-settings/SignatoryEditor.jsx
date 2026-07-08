const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function SignatoryEditor({ signatories = [], onChange }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {signatories.map((item, index) => (
        <div key={`signatory-${index}`} style={{ display: 'grid', gap: 8, padding: 10, border: '1px solid #E5E7EB', borderRadius: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={item.visible !== false}
              onChange={(e) => {
                const next = [...signatories]
                next[index] = { ...item, visible: e.target.checked }
                onChange(next)
              }}
            />
            Show signatory {index + 1}
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Title
            <input
              type="text"
              value={item.title || ''}
              onChange={(e) => {
                const next = [...signatories]
                next[index] = { ...item, title: e.target.value }
                onChange(next)
              }}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280' }}>
            Name (optional)
            <input
              type="text"
              value={item.name || ''}
              onChange={(e) => {
                const next = [...signatories]
                next[index] = { ...item, name: e.target.value }
                onChange(next)
              }}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
        </div>
      ))}
    </div>
  )
}
