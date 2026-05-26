import useLiveMetalRates from '../../../../hooks/useLiveMetalRates'
import StockTypeLivePrice from '../../../StockTypeLivePrice'
import { resolveLiveMetalKey } from '../../../../utils/liveMetalRates'

export default function ERPInventoryTab({
  activeTab,
  C,
  modalInputStyle,
  isSuperAdmin,
  isFinance,
  saving,
  token,
  tenantKey,
  loadInventory,
  inventoryMappingProducts,
  inventoryCatalogProducts,
  inventoryProductsByMetal,
  inventoryReportProducts,
  inventoryTotalQuantity,
  inventoryTotalValue,
  inventoryLowStockCount,
  inventoryMetalBreakdown,
  inventoryTopProducts,
  legacyInventoryProducts,
  inventoryVatFilter,
  inventoryVatSortDir,
  sortedInventoryTableRows,
  stockMovements,
  stockMovementsLoading,
  stockMovementsFilter,
  showInventoryProductModal,
  showInventoryMappingModal,
  editingProductId,
  editingInventoryProductId,
  stockTypeModalTab,
  inventoryModalOffset,
  inventoryModalDragging,
  inventoryProductModalOffset,
  inventoryProductModalDragging,
  inventoryMappingForm,
  inventoryProductForm,
  inventoryStockTypeOptions,
  inventoryProductPurityWeight,
  setEditingProductId,
  setInventoryMappingForm,
  setInventoryStockCodeManualOverride,
  setInventoryModalOffset,
  setShowInventoryMappingModal,
  setEditingInventoryProductId,
  setInventoryProductModalOffset,
  setShowInventoryProductModal,
  setInventoryVatFilter,
  setInventoryVatSortDir,
  setStockMovementsFilter,
  setInventoryProductForm,
  setStockTypeModalTab,
  createInventoryMappingForm,
  decodeInventoryCategoryMeta,
  titleCaseWords,
  formatVatPercent,
  resolveMainStockValueFromForm,
  handleEditProduct,
  handleDeleteProduct,
  handleEditInventoryCatalogProduct,
  handleDeleteInventoryCatalogProduct,
  loadStockLedger,
  resetInventoryProductForm,
  handleCreateInventoryCatalogProduct,
  handleInventoryProductModalDragStart,
  resetInventoryMappingForm,
  handleCreateProduct,
  handleInventoryModalDragStart,
}) {
  const { snapshot: liveMetalSnapshot, error: liveMetalError } = useLiveMetalRates({
    token,
    tenant: tenantKey,
    enabled: activeTab === 'inventory' && Boolean(token),
  })

  return (
  <>
      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Inventory Workspace</h3>
              <p style={{ margin: '0.35rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>Rebuilt inventory area with separate cards for stock types, products, and reporting.</p>
            </div>
            <button type="button" onClick={loadInventory} style={{ padding: '0.55rem 0.95rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}>Refresh Inventory</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'start' }}>
            <div style={{ background: '#FCFFFC', border: '1px solid #CDE7D4', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(5, 150, 105, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#14532D', fontSize: '1rem' }}>Stock Type Creation</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#3F5F48', fontSize: '0.8rem', lineHeight: 1.5 }}>Create the master stock types that define metal, material type, purity, and stock-code mapping.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#DCFCE7', color: '#166534', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryMappingProducts.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProductId('')
                  setInventoryMappingForm(createInventoryMappingForm())
                  setInventoryStockCodeManualOverride(false)
                  setInventoryModalOffset({ x: 0, y: 0 })
                  setShowInventoryMappingModal(true)
                }}
                style={{ marginTop: '0.85rem', width: '100%', padding: '0.7rem 0.95rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700' }}
              >
                + Create Stock Type
              </button>
              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
                {inventoryMappingProducts.slice(0, 4).map((item) => {
                  const meta = decodeInventoryCategoryMeta(item.category)
                  const liveMetalKey = resolveLiveMetalKey(meta.mainStock || meta.metalType || item.name)
                  return (
                    <div key={item._id} style={{ border: '1px solid #DCFCE7', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: '700', color: C.ink }}>{titleCaseWords(meta.mainStock || meta.metalType || item.name)}</span>
                        {liveMetalKey ? (
                          <StockTypeLivePrice
                            metalKey={liveMetalKey}
                            snapshot={liveMetalSnapshot}
                            error={liveMetalError}
                          />
                        ) : (
                          Number(item.unitCost || 0) > 0 && (
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#166534', background: '#DCFCE7', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                              {Number(item.unitCost).toLocaleString()}
                              {' '}
                              {item.currency || 'USD'}
                              /
                              {meta.priceUnit || 'OZ'}
                            </span>
                          )
                        )}
                      </div>
                      <div style={{ marginTop: '0.2rem', color: C.inkSoft, fontSize: '0.75rem' }}>Main Stock Mapping</div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => handleEditProduct(item)} style={{ padding: '0.28rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.72rem' }}>Edit</button>
                        {(isSuperAdmin || isFinance) && <button onClick={() => handleDeleteProduct(item)} style={{ padding: '0.28rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.72rem' }}>Delete</button>}
                      </div>
                    </div>
                  )
                })}
                {!inventoryMappingProducts.length && <div style={{ border: '1px dashed #BBF7D0', borderRadius: '0.5rem', padding: '0.75rem', color: '#166534', fontSize: '0.8rem' }}>No stock types yet. Create your first stock type to define mapping rules.</div>}
              </div>
            </div>

            <div style={{ background: '#FFFDF8', border: '1px solid #F2DFC1', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#92400E', fontSize: '1rem' }}>Product Creation</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#7C5A12', fontSize: '0.8rem', lineHeight: 1.5 }}>Create products with Product Category, Name, Description, Weight, Gross Weight, Purity, Tax Type, VAT %, and Purity Weight.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#FEF3C7', color: '#92400E', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryCatalogProducts.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingInventoryProductId('')
                  setInventoryProductModalOffset({ x: 0, y: 0 })
                  setShowInventoryProductModal(true)
                }}
                style={{ marginTop: '0.85rem', width: '100%', padding: '0.7rem 0.95rem', background: '#B45309', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700' }}
              >
                + Create Product
              </button>
              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
                {Object.entries(inventoryProductsByMetal).slice(0, 4).map(([metal, entries]) => (
                  <div key={metal} style={{ border: '1px solid #FDE68A', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontWeight: '800', color: '#92400E', fontSize: '0.78rem', marginBottom: '0.35rem' }}>{metal}</div>
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      {entries.slice(0, 3).map(({ item, meta }) => (
                        <div key={item._id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', borderTop: '1px solid #FEF3C7', paddingTop: '0.35rem' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: C.ink, fontSize: '0.76rem' }}>{item.name}</div>
                            <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>Category {meta.productCategory || metal} | Wt {Number(meta.weight || item.quantity || 0).toLocaleString()} g | Purity {meta.productPurity || meta.purity || '-'} | Tax {meta.taxType || '-'} | VAT {formatVatPercent(meta.vatPercent)} | Pure Wt {Number(meta.purityWeight || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                          </div>
                          <div style={{ display: 'grid', justifyItems: 'end', gap: '0.35rem' }}>
                            <div style={{ color: '#92400E', fontWeight: '700', fontSize: '0.74rem', maxWidth: '220px', textAlign: 'right' }}>{meta.productDescription || '-'}</div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button type="button" onClick={() => handleEditInventoryCatalogProduct(item, meta)} style={{ padding: '0.24rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700' }}>Edit</button>
                              {(isSuperAdmin || isFinance) && <button type="button" onClick={() => handleDeleteInventoryCatalogProduct(item)} style={{ padding: '0.24rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700' }}>Delete</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!inventoryCatalogProducts.length && <div style={{ border: '1px dashed #FCD34D', borderRadius: '0.5rem', padding: '0.75rem', color: '#92400E', fontSize: '0.8rem' }}>No inventory products created yet. Use a stock type to start adding products.</div>}
              </div>
            </div>

            <div style={{ background: '#FBFCFF', border: '1px solid #D9E6FB', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(29, 78, 216, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#1D4ED8', fontSize: '1rem' }}>Inventory Report</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#4B5E8B', fontSize: '0.8rem', lineHeight: 1.5 }}>Live snapshot of stock left by product and metal, including quantity on hand, inventory value, and low-stock exposure.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#DBEAFE', color: '#1D4ED8', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryReportProducts.length}</span>
              </div>
              <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Stock Types</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryMappingProducts.length}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Products</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryCatalogProducts.length}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Gross Stock Left</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryTotalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Inventory Value</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryTotalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
              </div>
              <div style={{ marginTop: '0.7rem', border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontWeight: '700', color: C.ink, fontSize: '0.8rem' }}>Stock Left By Metal</span>
                  <span style={{ color: inventoryLowStockCount > 0 ? '#B45309' : '#1D4ED8', fontWeight: '700', fontSize: '0.75rem' }}>Low/Zero Stock: {inventoryLowStockCount}</span>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {inventoryMetalBreakdown.map((row) => (
                    <div key={row.metal} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', paddingBottom: '0.45rem', borderBottom: '1px solid #EFF6FF' }}>
                      <div>
                        <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem' }}>{row.metal}</div>
                        <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{row.productCount} product{row.productCount === 1 ? '' : 's'} | Gross Stock Left {row.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} | Low/Zero Stock {row.lowStockCount}</div>
                      </div>
                      <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem', textAlign: 'right' }}>{row.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                  {!inventoryMetalBreakdown.length && <div style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No metal/product breakdown available yet.</div>}
                </div>
              </div>
              <div style={{ marginTop: '0.7rem', border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontWeight: '700', color: C.ink, fontSize: '0.8rem' }}>Top Inventory Items</span>
                  <span style={{ color: '#1D4ED8', fontWeight: '700', fontSize: '0.75rem' }}>Showing highest value items</span>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {inventoryTopProducts.map((row) => {
                    const { item, productMeta } = row
                    return (
                      <div key={item._id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #EFF6FF' }}>
                        <div>
                          <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem' }}>{item.name}</div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{row.metal} | Category {row.categoryName} | Gross Stock Left {row.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {row.stockUnit} | Stock Value {row.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>Gross Wt {row.weight.toLocaleString(undefined, { maximumFractionDigits: 4 })} g | Purity {row.purity || '-'} | Tax {productMeta.taxType || '-'} | VAT {formatVatPercent(productMeta.vatPercent)} | Pure Wt {row.purityWeight.toLocaleString(undefined, { maximumFractionDigits: 4 })} | Pure Stock {row.pureStockQty.toLocaleString(undefined, { maximumFractionDigits: 4 })} g</div>
                        </div>
                        <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem', textAlign: 'right' }}>
                          <div>{row.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          <div style={{ color: row.quantity <= 0 ? '#B91C1C' : row.isLowStock ? '#B45309' : C.inkSoft, fontSize: '0.7rem' }}>{row.quantity <= 0 ? 'Zero Stock' : row.isLowStock ? 'Low Stock' : 'In Stock'}</div>
                        </div>
                      </div>
                    )
                  })}
                  {!inventoryTopProducts.length && <div style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No inventory movements or product records yet.</div>}
                </div>
              </div>
            </div>
          </div>

          {legacyInventoryProducts.length > 0 && (
            <p style={{ marginTop: '0.8rem', color: '#92400E', fontSize: '0.8rem' }}>
              Legacy inventory records still exist outside the new stock-type/product structure: {legacyInventoryProducts.length}
            </p>
          )}

          {/* All Inventory Items Table */}
          {inventoryReportProducts.length > 0 && (
            <div style={{ marginTop: '1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>All Inventory Items</p>
                  <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Live stock on hand — quantities updated automatically when sale/purchase vouchers are posted.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={inventoryVatFilter}
                    onChange={(e) => setInventoryVatFilter(e.target.value)}
                    style={{ padding: '0.35rem 0.55rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.78rem', color: C.ink, background: '#FFFFFF' }}
                  >
                    <option value="all">VAT: All</option>
                    <option value="with-vat">VAT: &gt; 0%</option>
                    <option value="zero-or-blank">VAT: 0% / Blank</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setInventoryVatSortDir((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'))}
                    style={{ padding: '0.35rem 0.55rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.78rem', color: C.ink, background: '#FFFFFF', cursor: 'pointer', fontWeight: '600' }}
                  >
                    VAT Sort: {inventoryVatSortDir === 'none' ? 'None' : inventoryVatSortDir === 'asc' ? 'Low-High' : 'High-Low'}
                  </button>
                  <span style={{ padding: '0.3rem 0.6rem', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>{sortedInventoryTableRows.length} items</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['SKU', 'Name', 'Category', 'Tax Type', 'VAT %', 'Qty On Hand (Gross)', 'Pure Qty', 'Unit', 'Unit Cost', 'Selling Price', 'Total Value', 'Min Stock', 'Status'].map(col => {
                        const isVatCol = col === 'VAT %'
                        const vatSortIndicator = inventoryVatSortDir === 'none' ? '' : inventoryVatSortDir === 'asc' ? ' ▲' : ' ▼'
                        return (
                          <th
                            key={col}
                            onClick={isVatCol ? () => setInventoryVatSortDir((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')) : undefined}
                            title={isVatCol ? 'Click to sort VAT %' : undefined}
                            style={{
                              padding: '0.55rem 0.7rem',
                              textAlign: col === 'VAT %' || col === 'Qty On Hand (Gross)' || col === 'Pure Qty' || col === 'Unit Cost' || col === 'Selling Price' || col === 'Total Value' ? 'right' : 'left',
                              color: '#374151',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              cursor: isVatCol ? 'pointer' : 'default',
                              userSelect: isVatCol ? 'none' : 'auto',
                            }}
                          >
                            {isVatCol ? `${col}${vatSortIndicator}` : col}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInventoryTableRows.map(({ item, categoryMeta, productMeta, reportRow }) => {
                      const displayQty = Math.max(0, Number(item.quantity || 0))
                      const zeroStock = displayQty <= 0
                      const lowStock = zeroStock || (Number(item.minThreshold || 0) > 0 && displayQty <= Number(item.minThreshold || 0))
                      const totalValue = displayQty * Number(item.unitCost || 0)
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #F1F5F9', background: lowStock ? '#FFF7ED' : undefined }}>
                          <td style={{ padding: '0.5rem 0.7rem', color: '#6B7280', fontFamily: 'monospace' }}>{item.sku || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', fontWeight: '600', color: C.ink }}>{item.name}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{item.category ? (categoryMeta.mainStock || item.category).slice(0, 30) : '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{productMeta.taxType || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft, fontSize: '0.78rem' }}>{formatVatPercent(productMeta.vatPercent)}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: lowStock ? '#B45309' : '#065F46' }}>{displayQty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(reportRow?.pureStockQty || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft }}>{item.unit || 'pcs'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(item.unitCost || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(item.sellingPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: '#1D4ED8' }}>{totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>{Number(item.minThreshold || 0) || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem' }}>
                            {zeroStock
                              ? <span style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: '700' }}>Zero Stock</span>
                              : lowStock
                              ? <span style={{ background: '#FEF3C7', color: '#B45309', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: '700' }}>Low Stock</span>
                              : <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: '700' }}>OK</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock Movements from Vouchers */}
          <div style={{ marginTop: '1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Stock Movement History</p>
                <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Every inventory change from posted sale/purchase vouchers — full audit trail.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Search item or reason..."
                  value={stockMovementsFilter}
                  onChange={e => setStockMovementsFilter(e.target.value)}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid #D1D5DB', borderRadius: '0.4rem', fontSize: '0.82rem', minWidth: '180px' }}
                />
                <button type="button" onClick={loadStockLedger} style={{ padding: '0.4rem 0.8rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.4rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}>
                  {stockMovementsLoading ? 'Loading…' : 'Refresh'}
                </button>
                <span style={{ padding: '0.3rem 0.6rem', background: '#F1F5F9', color: '#475569', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>{stockMovements.length} entries</span>
              </div>
            </div>
            {stockMovementsLoading
              ? <div style={{ textAlign: 'center', padding: '1.5rem', color: C.inkSoft }}>Loading stock movements…</div>
              : stockMovements.length === 0
                ? (
                  <div style={{ border: '1px dashed #CBD5E0', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.85rem' }}>No stock movements yet.</p>
                    <p style={{ margin: '0.4rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Post a sale or purchase voucher with a product linked to an inventory item to see movements here.</p>
                  </div>
                )
                : (() => {
                  const STOCK_MOVEMENTS_UI_CAP = 200
                  const filtered = stockMovementsFilter.trim()
                    ? stockMovements.filter(m =>
                        String(m.itemName || '').toLowerCase().includes(stockMovementsFilter.toLowerCase()) ||
                        String(m.reason || '').toLowerCase().includes(stockMovementsFilter.toLowerCase()) ||
                        String(m.actorName || '').toLowerCase().includes(stockMovementsFilter.toLowerCase())
                      )
                    : stockMovements
                  const shown = filtered.slice(0, STOCK_MOVEMENTS_UI_CAP)
                  return (
                    <div>
                      {filtered.length > STOCK_MOVEMENTS_UI_CAP && (
                        <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                          Showing first {STOCK_MOVEMENTS_UI_CAP} of {filtered.length} movements (UI cap). Refine filter to narrow results.
                        </p>
                      )}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                            {['Date', 'Item', 'Change', 'Before', 'After', 'Reason (Voucher)', 'By'].map(col => (
                              <th key={col} style={{ padding: '0.55rem 0.7rem', textAlign: col === 'Change' || col === 'Before' || col === 'After' ? 'right' : 'left', color: '#374151', fontWeight: '700', whiteSpace: 'nowrap' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((m, i) => {
                            const isIn = Number(m.change || 0) > 0
                            return (
                              <tr key={m._id || i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, whiteSpace: 'nowrap' }}>
                                  {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', fontWeight: '600', color: C.ink }}>{m.itemName}</td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: isIn ? '#166534' : '#B91C1C' }}>
                                  {isIn ? '+' : ''}{Number(m.change || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>{Number(m.quantityBefore || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '600', color: C.ink }}>{Number(m.quantityAfter || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                <td style={{ padding: '0.5rem 0.7rem' }}>
                                  <span style={{ background: isIn ? '#DCFCE7' : '#FEE2E2', color: isIn ? '#166534' : '#991B1B', borderRadius: '0.3rem', padding: '0.18rem 0.45rem', fontSize: '0.78rem', fontWeight: '600' }}>
                                    {m.reason || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{m.actorName || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )
                })()
            }
          </div>

          {showInventoryProductModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={(e) => { if (e.target === e.currentTarget) resetInventoryProductForm() }}>
              <form onSubmit={handleCreateInventoryCatalogProduct} style={{ width: 'min(1100px, 96vw)', background: '#FFFFFF', border: '1px solid #CBD5E0', borderRadius: '0.5rem', padding: 0, boxShadow: '0 20px 42px rgba(0,0,0,0.35)', overflow: 'hidden', transform: `translate(${inventoryProductModalOffset.x}px, ${inventoryProductModalOffset.y}px)`, userSelect: inventoryProductModalDragging ? 'none' : 'auto' }}>
                <div style={{ height: 0, overflow: 'hidden' }} />
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', backgroundColor: '#3F4B2E', color: '#FFFFFF', padding: '1rem', cursor: inventoryProductModalDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={handleInventoryProductModalDragStart}
                >
                  <div>
                    <p style={{ margin: 0, color: '#FFFFFF', fontWeight: '800', fontSize: '1.08rem' }}>{editingInventoryProductId ? 'Edit Product' : 'Product Creation'}</p>
                    <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.88)', fontSize: '0.84rem' }}>Enter Product Category, Name, Description, Weight, Gross Weight, Purity, Tax Type, VAT %, and auto-calculated Purity Weight.</p>
                  </div>
                  <button type="button" onClick={resetInventoryProductForm} style={{ border: 'none', background: 'transparent', color: '#FFFFFF', cursor: 'pointer', fontSize: '1.45rem', lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ padding: '1.2rem 1.5rem', background: '#F3F4F6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                    <select value={inventoryProductForm.stockTypeId} onChange={(e) => {
                      const option = inventoryStockTypeOptions.find((item) => item.id === e.target.value)
                      setInventoryProductForm((prev) => ({ ...prev, stockTypeId: e.target.value, categoryName: option?.mainStock || '', purity: prev.purity || option?.purity || '' }))
                    }} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}>
                      <option value="">Product Category</option>
                      {inventoryStockTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <input placeholder="Product Name" value={inventoryProductForm.name} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, name: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input placeholder="Description" value={inventoryProductForm.description} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input type="number" step="0.0001" placeholder="Weight" value={inventoryProductForm.weight} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, weight: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input type="number" step="0.0001" placeholder="Gross Weight" value={inventoryProductForm.grossWeight} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, grossWeight: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input placeholder="Purity" value={inventoryProductForm.purity} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, purity: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <select value={inventoryProductForm.taxType} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, taxType: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}>
                      <option value="VAT">VAT</option>
                      <option value="GST">GST</option>
                      <option value="Sales Tax">Sales Tax</option>
                      <option value="None">None</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="VAT %"
                      value={inventoryProductForm.vatPercent}
                      onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, vatPercent: e.target.value }))}
                      style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}
                    />
                    <input value={inventoryProductPurityWeight ? inventoryProductPurityWeight.toLocaleString(undefined, { maximumFractionDigits: 4 }) : ''} readOnly placeholder="Purity Weight" style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#EEF2F7', color: C.inkSoft, borderRadius: '0.45rem' }} />
                  </div>
                </div>
                <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={resetInventoryProductForm} style={{ padding: '0.6rem 1.2rem', background: '#E5E7EB', color: '#111827', border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                  <button type="button" disabled={saving} onClick={(e) => handleCreateInventoryCatalogProduct({ preventDefault: () => e.preventDefault() })} style={{ padding: '0.6rem 1.2rem', backgroundColor: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', opacity: saving ? 0.75 : 1 }}>{saving ? 'Saving...' : editingInventoryProductId ? 'Update Product' : 'Create Product'}</button>
                </div>
              </form>
            </div>
          )}

          {showInventoryMappingModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={(e) => { if (e.target === e.currentTarget) resetInventoryMappingForm() }}
            >
              <form
                onSubmit={handleCreateProduct}
                style={{
                  width: 'min(980px, 98vw)',
                  maxHeight: '88vh',
                  overflowY: 'auto',
                  background: '#E3DEDE',
                  border: '1px solid #987973',
                  borderRadius: '0.62rem',
                  padding: '0.38rem',
                  boxShadow: '0 14px 26px rgba(0, 0, 0, 0.22)',
                  transform: `translate(${inventoryModalOffset.x}px, ${inventoryModalOffset.y}px)`,
                  userSelect: inventoryModalDragging ? 'none' : 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.35rem',
                    padding: '0.3rem 0.55rem',
                    borderRadius: '0.34rem 0.34rem 0 0',
                    border: '1px solid #A5857F',
                    background: '#B69A95',
                    cursor: inventoryModalDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={handleInventoryModalDragStart}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.01em', fontSize: '0.97rem' }}>{editingProductId ? 'Stock Type Creation' : 'Stock Type Creation'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.38rem' }}>
                    <button type="button" onClick={resetInventoryMappingForm} style={{ width: '1.08rem', height: '1.08rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1 }}>x</button>
                  </div>
                </div>

                <div style={{ border: '1px solid #A5857F', borderRadius: '0 0 0.36rem 0.36rem', background: '#F3F0F0', padding: '0.45rem' }}>
                  <div style={{ border: '1px solid #B39792', borderRadius: '0.2rem', background: '#F0ECEC', padding: '0.34rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.22rem', marginBottom: '0.3rem' }}>
                      {[['details','Details'],['pricing','Pricing'],['stockenquiry','Stock Enquiry']].map(([key, label]) => (
                        <span key={key} onClick={() => setStockTypeModalTab(key)} style={{ fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer', color: stockTypeModalTab === key ? '#724B46' : '#9B817C', padding: '0.14rem 0.34rem', border: `1px solid ${stockTypeModalTab === key ? '#B99E98' : '#CDB9B5'}`, borderBottom: stockTypeModalTab === key ? 'none' : '1px solid #B99E98', borderRadius: '0.22rem 0.22rem 0 0', background: stockTypeModalTab === key ? '#F8F5F4' : '#EEE8E7', userSelect: 'none' }}>{label}</span>
                      ))}
                    </div>

                    <div style={{ border: '1px solid #B99E98', background: '#FCFBFB', padding: '0.48rem' }}>
                      {stockTypeModalTab === 'pricing' && (
                        <div style={{ border: '1px solid #C7AEAA', background: '#F5F1F1', padding: '0.42rem', maxWidth: '360px' }}>
                            <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#6F4B45', fontWeight: '700' }}>Current Price</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center', marginBottom: '0.28rem' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Price :</label>
                              <input
                                type="number" step="0.01"
                                placeholder="Enter price"
                                value={inventoryMappingForm.currentPrice}
                                onChange={e => setInventoryMappingForm(prev => ({ ...prev, currentPrice: e.target.value }))}
                                style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center', marginBottom: '0.28rem' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Unit :</label>
                              <select value={inventoryMappingForm.priceUnit} onChange={e => setInventoryMappingForm(prev => ({ ...prev, priceUnit: e.target.value }))} style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}>
                                <option value="OZ">Per OZ (Troy)</option>
                                <option value="GRAM">Per Gram</option>
                                <option value="KG">Per KG</option>
                              </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Currency :</label>
                              <select value={inventoryMappingForm.priceCurrency} onChange={e => setInventoryMappingForm(prev => ({ ...prev, priceCurrency: e.target.value }))} style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}>
                                <option value="USD">USD</option>
                                <option value="AED">AED</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                              </select>
                            </div>
                        </div>
                      )}
                      {stockTypeModalTab !== 'pricing' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(250px, 0.9fr)', gap: '0.45rem' }}>
                      <div style={{ border: '1px solid #C7AEAA', background: '#F5F1F1', padding: '0.42rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: '0.28rem', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Mtl Type :</label>
                          <input
                            placeholder="e.g. Gold, Silver, Platinum"
                            value={inventoryMappingForm.mainStock}
                            onChange={(e) => {
                              const val = e.target.value
                              setInventoryMappingForm((prev) => ({ ...prev, mainStock: val, metalType: val.trim().toLowerCase() }))
                            }}
                            style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ border: '1px solid #C7AEAA', background: '#F8F4F4', padding: '0.42rem' }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#6F4B45', fontWeight: '700' }}>Stock Information</p>
                        <div style={{ marginTop: '0.35rem', display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.24rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#7A5A53', fontWeight: '700' }}>Description :</span>
                          <span style={{ fontSize: '0.7rem', color: '#2F2624', border: '1px solid #C9B2AE', background: '#FFFFFF', padding: '0.2rem 0.34rem' }}>{titleCaseWords(resolveMainStockValueFromForm(inventoryMappingForm) || '-')}</span>
                          <span style={{ fontSize: '0.7rem', color: '#7A5A53', fontWeight: '700' }}>Details :</span>
                          <span style={{ fontSize: '0.7rem', color: '#2F2624', border: '1px solid #C9B2AE', background: '#FFFFFF', padding: '0.2rem 0.34rem' }}>{`mainStock=${resolveMainStockValueFromForm(inventoryMappingForm) || '-'};metalType=${inventoryMappingForm.metalType || '-'}`}</span>
                        </div>
                      </div>
                    </div>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.46rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={resetInventoryMappingForm} style={{ padding: '0.38rem 0.8rem', background: '#ECE7E6', color: '#473A37', border: '1px solid #B99E98', borderRadius: '0.2rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.74rem' }}>Cancel</button>
                  <button type="submit" disabled={saving} style={{ padding: '0.38rem 0.8rem', background: '#8A5C54', color: '#fff', border: '1px solid #744742', borderRadius: '0.2rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.74rem' }}>{saving ? 'Saving...' : editingProductId ? 'Save Stock Type' : 'Create Stock Type'}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  )
}
