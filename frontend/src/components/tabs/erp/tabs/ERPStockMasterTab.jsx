import {
  createInventoryProductForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  formatVatPercent,
  titleCaseWords,
} from '../erpTabUtils'

/**
 * Stock Master — create / edit / delete stock types and products.
 * Shares inventory modal state/handlers with ERPInventoryTab.
 */
export default function ERPStockMasterTab({
  activeTab,
  C,
  isSuperAdmin,
  isFinance,
  loadInventory,
  inventoryMappingProducts = [],
  inventoryCatalogProducts = [],
  createInventoryMappingForm,
  baseCurrencyCode = 'USD',
  setEditingProductId,
  setInventoryMappingForm,
  setInventoryStockCodeManualOverride,
  setInventoryModalOffset,
  setShowInventoryMappingModal,
  setEditingInventoryProductId,
  setInventoryProductForm,
  setInventoryProductModalOffset,
  setShowInventoryProductModal,
  handleEditProduct,
  handleDeleteProduct,
  handleEditInventoryCatalogProduct,
  handleDeleteInventoryCatalogProduct,
}) {
  if (activeTab !== 'stock-master') return null

  const openCreateStockType = () => {
    setEditingProductId('')
    setInventoryMappingForm(createInventoryMappingForm(baseCurrencyCode))
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setShowInventoryMappingModal(true)
  }

  const openCreateProduct = () => {
    setEditingInventoryProductId('')
    setInventoryProductForm(createInventoryProductForm())
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setShowInventoryProductModal(true)
  }

  const canDelete = Boolean(isSuperAdmin || isFinance)

  const stockTypes = (inventoryMappingProducts || []).map((item) => {
    const meta = decodeInventoryCategoryMeta(item.category)
    const pairs = decodeInventoryCategoryPairs(item.category)
    return {
      item,
      meta: { ...meta, stockCode: pairs.stockCode || '' },
      label: titleCaseWords(meta.mainStock || meta.metalType || item.name || 'Stock'),
    }
  })

  const products = (inventoryCatalogProducts || []).map((item) => {
    const meta = decodeInventoryCategoryPairs(item.category)
    return {
      item,
      meta,
      metal: titleCaseWords(meta.mainStock || meta.metalType || meta.productCategory || 'Unmapped'),
      qty: Math.max(0, Number(item.quantity || 0)),
    }
  })

  const actionBtn = (kind) => ({
    padding: '0.22rem 0.55rem',
    borderRadius: '0.35rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: kind === 'edit' ? 'none' : '1px solid #FECACA',
    background: kind === 'edit' ? '#166534' : '#FFFFFF',
    color: kind === 'edit' ? '#FFFFFF' : '#B91C1C',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: 700 }}>Stock Master</h3>
          <p style={{ margin: '0.35rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>
            Create, edit, and delete stock types and products.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={openCreateStockType}
            style={{ padding: '0.55rem 0.95rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: 700 }}
          >
            + Create Stock Type
          </button>
          <button
            type="button"
            onClick={openCreateProduct}
            style={{ padding: '0.55rem 0.95rem', background: '#B45309', color: '#fff', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: 700 }}
          >
            + Create Product
          </button>
          <button
            type="button"
            onClick={loadInventory}
            style={{ padding: '0.55rem 0.95rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.45rem', cursor: 'pointer', fontWeight: 700 }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <section style={{ background: '#FFFFFF', border: `1px solid ${C.p2}`, borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: C.ink, fontSize: '1rem' }}>Stock Types</p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>Metal categories used by products.</p>
            </div>
            <span style={{ padding: '0.25rem 0.55rem', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '999px', fontWeight: 700, fontSize: '0.72rem' }}>
              {stockTypes.length}
            </span>
          </div>
          {stockTypes.length === 0 ? (
            <div style={{ border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              No stock types yet. Use + Create Stock Type.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {stockTypes.map(({ item, meta, label }) => (
                <div
                  key={item._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem',
                    border: `1px solid ${C.p2}`,
                    borderRadius: '0.45rem',
                    padding: '0.55rem 0.65rem',
                    background: C.p1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: C.ink, fontSize: '0.88rem' }}>{label}</div>
                    <div style={{ marginTop: '0.15rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                      Code {item.sku || meta.stockCode || '—'}
                      {meta.purity ? ` · Purity ${meta.purity}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button type="button" style={actionBtn('edit')} onClick={() => handleEditProduct(item)}>Edit</button>
                    {canDelete && (
                      <button type="button" style={actionBtn('delete')} onClick={() => handleDeleteProduct(item)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: '#FFFFFF', border: `1px solid ${C.p2}`, borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: C.ink, fontSize: '1rem' }}>Products</p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>Catalog items under each stock type.</p>
            </div>
            <span style={{ padding: '0.25rem 0.55rem', background: '#FFEDD5', color: '#9A3412', borderRadius: '999px', fontWeight: 700, fontSize: '0.72rem' }}>
              {products.length}
            </span>
          </div>
          {products.length === 0 ? (
            <div style={{ border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              No products yet. Create a stock type first, then + Create Product.
            </div>
          ) : (
            <div className="erp-table-wrap" style={{ overflow: 'auto', maxHeight: 520, border: 'none' }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th style={{ textAlign: 'left' }}>Category</th>
                    <th className="num">Qty</th>
                    <th style={{ textAlign: 'left' }}>Purity</th>
                    <th style={{ textAlign: 'left' }}>VAT</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(({ item, meta, metal, qty }) => (
                    <tr key={item._id} style={{ borderBottom: '1px solid #F1F5F9', background: qty <= 0 ? '#FFFBEB' : undefined }}>
                      <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: C.ink }}>{item.name}</td>
                      <td style={{ padding: '0.45rem 0.6rem', color: C.inkSoft, fontSize: '0.78rem', textTransform: 'lowercase' }}>{metal}</td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 700, color: qty <= 0 ? '#B45309' : '#065F46' }}>
                        {qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', color: C.inkSoft, fontSize: '0.78rem' }}>
                        {meta.productPurity || meta.purity || '—'}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', color: C.inkSoft, fontSize: '0.78rem' }}>
                        {formatVatPercent(meta.vatPercent)}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                          <button type="button" style={actionBtn('edit')} onClick={() => handleEditInventoryCatalogProduct(item, meta)}>Edit</button>
                          {canDelete && (
                            <button type="button" style={actionBtn('delete')} onClick={() => handleDeleteInventoryCatalogProduct(item)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
