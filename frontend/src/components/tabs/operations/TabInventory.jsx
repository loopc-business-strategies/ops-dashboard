import { useEffect, useState } from 'react'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, StatCard, TableWrap, SH, Restrict, TH, TD } from './operationsTabUI'

export default function TabInventory({
  inventory,
  canEdit,
  isExternal,
  isMgmt,
  showToast,
  setModal,
  onDeleteInventory,
  inventoryTotal = 0,
  inventoryPage = 1,
  inventoryLimit = 50,
  inventorySearch = '',
  onInventorySearch,
  onInventoryPageChange,
}) {
  const [searchDraft, setSearchDraft] = useState(inventorySearch || '')

  useEffect(() => {
    setSearchDraft(inventorySearch || '')
  }, [inventorySearch])

  if (isExternal || isMgmt) return <Restrict text="Inventory tracking is restricted to Operations team." />

  const totalPages = Math.max(1, Math.ceil(Number(inventoryTotal || 0) / inventoryLimit) || 1)

  async function copyItemId(id) {
    try {
      await navigator.clipboard.writeText(String(id))
      showToast('Copied', 'Item ID copied to clipboard')
    } catch {
      showToast('Copy failed', String(id))
    }
  }

  function applySearch(e) {
    e?.preventDefault?.()
    onInventorySearch?.(searchDraft.trim())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH title="Inventory & Stock Tracking" sub={`${inventory.filter((i) => i.st === 'Critical').length} critical · ${inventory.filter((i) => i.st === 'Low Stock').length} low stock · ${inventoryTotal} total`}>
        {canEdit && <button className={B.pri} onClick={() => setModal({ type: 'inventory-add', data: null })}>+ Add Item</button>}
        {!canEdit && (
          <span style={{ fontSize: 12, color: C.t3, alignSelf: 'center' }}>
            Edits require Super Admin or Production Head
          </span>
        )}
      </SH>

      <form onSubmit={applySearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search name, SKU, supplier, or Item ID"
          style={{
            flex: '1 1 220px',
            minWidth: 180,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            padding: '0 12px',
            fontFamily: 'inherit',
            fontSize: 13,
            background: 'var(--bg-card, #fff)',
            color: C.t1,
          }}
        />
        <button type="submit" className={B.sec}>Search</button>
        {inventorySearch ? (
          <button
            type="button"
            className={B.sec}
            onClick={() => {
              setSearchDraft('')
              onInventorySearch?.('')
            }}
          >
            Clear
          </button>
        ) : null}
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 11 }}>
        <StatCard label="Critical Stock" value={<span style={{ color: C.red }}>{inventory.filter((i) => i.st === 'Critical').length}</span>} sub="On this page" dot={C.red} />
        <StatCard label="Low Stock" value={<span style={{ color: C.yellow }}>{inventory.filter((i) => i.st === 'Low Stock').length}</span>} sub="On this page" dot={C.yellow} />
        <StatCard label="Sufficient" value={<span style={{ color: C.green }}>{inventory.filter((i) => i.st === 'Sufficient').length}</span>} sub="On this page" dot={C.green} />
      </div>

      <TableWrap>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                {['Item ID', 'Item', 'SKU', 'Unit', 'Current Stock', 'Min. Level', 'Stock Status', 'Supplier', 'Last Restocked', 'Actions'].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...TD, color: C.t3, textAlign: 'center', padding: 24 }}>
                    No inventory items found
                  </td>
                </tr>
              ) : inventory.map((i) => {
                const rowBg = i.st === 'Critical' ? 'rgba(255,71,87,.04)' : i.st === 'Low Stock' ? 'rgba(255,214,0,.03)' : 'rgba(0,200,150,.03)'
                const unitLabel = i.unit || 'units'
                return (
                  <tr key={i.id} style={{ background: rowBg }}>
                    <td style={{ ...TD, fontWeight: 700, color: C.t1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 160 }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(i.id)}>
                          {String(i.id).slice(0, 8)}…
                        </span>
                        <button
                          type="button"
                          onClick={() => copyItemId(i.id)}
                          style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--purple)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', padding: '2px 6px', flexShrink: 0 }}
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td style={TD}>
                      {i.item}
                      {i.isMetalLinked ? (
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Metal / vault — qty via ERP</div>
                      ) : null}
                    </td>
                    <td style={{ ...TD, color: C.t2, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{i.sku || '—'}</td>
                    <td style={{ ...TD, color: C.t2 }}>{unitLabel}</td>
                    <td style={{ ...TD, color: i.stock === 0 ? C.red : i.stock < i.min ? C.yellow : C.green, fontWeight: 700 }}>
                      {i.stock} {unitLabel}
                    </td>
                    <td style={{ ...TD, color: C.t3 }}>{i.min} {unitLabel}</td>
                    <td style={TD}><Badge s={i.st} /></td>
                    <td style={{ ...TD, color: C.t2 }}>{i.sup}</td>
                    <td style={{ ...TD, color: C.t3 }}>{i.last}</td>
                    <td style={TD}>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'inventory-edit', data: i })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginRight: 8 }}
                        >
                          Edit
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDeleteInventory && onDeleteInventory(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
                        >
                          Del
                        </button>
                      )}
                      {i.st === 'Critical' && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,71,87,.15)', color: C.red, border: '1px solid rgba(255,71,87,.3)' }}>
                          ⚠ URGENT
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {inventoryTotal > inventoryLimit ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--border-color)', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.t3 }}>
              Page {inventoryPage} of {totalPages} · {inventoryTotal} items
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={B.sec}
                disabled={inventoryPage <= 1}
                onClick={() => onInventoryPageChange?.(Math.max(1, inventoryPage - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className={B.sec}
                disabled={inventoryPage >= totalPages}
                onClick={() => onInventoryPageChange?.(inventoryPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </TableWrap>
    </div>
  )
}
