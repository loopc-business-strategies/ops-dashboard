import { useEffect, useState } from 'react'
import StockTypeLivePrice from '../../../StockTypeLivePrice'
import { resolveLiveMetalKey, resolveLiveInventoryUnitCost } from '../../../../utils/liveMetalRates'
import { formatAmount } from '../../../../utils/money'
import { useVirtualTableRows } from '../../../../hooks/useVirtualTableRows'
import { createInventoryProductForm } from '../erpTabUtils'
import { sanitizeCatalogProductPurity } from '../inventoryFormDefaults'
import {
  FLOATING_MODAL_FOOTER_END_PAD,
  FloatingModalResizeHandle,
  useFloatingModalChrome,
} from '../useFloatingModalChrome'

/** Tenant-branded chrome shared by Product / Stock Type inventory modals. */
const INV_MODAL = {
  headerBg: 'var(--brand-dark, var(--brand-primary))',
  headerFg: 'var(--brand-on-solid, #FFFFFF)',
  headerMuted: 'color-mix(in srgb, var(--brand-on-solid, #FFFFFF) 88%, transparent)',
  bodyBg: 'color-mix(in srgb, var(--brand-soft) 45%, #F3F4F6)',
  cardBg: '#FFFFFF',
  cardBorder: 'var(--brand-border, #E5E7EB)',
  footerBg: 'color-mix(in srgb, var(--brand-soft) 35%, #F9FAFB)',
  inputBorder: 'var(--brand-border, #CBD5E0)',
  inputBg: '#FFFFFF',
  inputReadonlyBg: 'color-mix(in srgb, var(--brand-soft) 55%, #EEF2F7)',
  cancelBg: '#E5E7EB',
  cancelFg: '#111827',
  primaryBg: 'var(--brand-button-bg, var(--brand-primary))',
  primaryFg: 'var(--brand-button-text, var(--brand-on-primary, #FFFFFF))',
  closeBtnBg: 'color-mix(in srgb, var(--brand-on-solid, #FFFFFF) 14%, transparent)',
  radius: '0.65rem',
  inputRadius: '0.45rem',
}

const invFieldLabel = {
  display: 'block',
  fontSize: '0.72rem',
  color: '#64748B',
  fontWeight: 600,
  marginBottom: '0.3rem',
}

const INVENTORY_VIEW_TABS = [
  {
    id: 'items',
    label: 'Inventory Items',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05" />
        <path d="M12 22.08V12" />
      </svg>
    ),
  },
  {
    id: 'movements',
    label: 'Stock Movement History',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
  },
]

export default function ERPInventoryTab({
  activeTab,
  C,
  modalInputStyle,
  isSuperAdmin,
  isFinance,
  saving,
  token: _token,
  tenantKey: _tenantKey,
  liveMetalSnapshot = null,
  liveMetalError = null,
  loadInventory,
  inventoryMappingProducts,
  inventoryCatalogProducts,
  inventoryProductsByMetal,
  inventoryReportProducts,
  inventoryTotalQuantity,
  inventoryTotalValue,
  inventoryTotalLiveValue,
  inventoryLowStockCount,
  inventoryMetalBreakdown,
  inventoryTopProducts: _inventoryTopProducts,
  legacyInventoryProducts,
  inventoryVatFilter,
  inventoryVatSortDir,
  sortedInventoryTableRows,
  stockMovements,
  stockMovementsLoading,
  baseCurrencyCode = 'USD',
  currencies = [],
  stockMovementsFilter,
  showInventoryProductModal,
  showInventoryMappingModal,
  editingProductId,
  editingInventoryProductId,
  stockTypeModalTab: _stockTypeModalTab,
  inventoryModalOffset: _inventoryModalOffset,
  inventoryModalDragging: _inventoryModalDragging,
  inventoryProductModalOffset: _inventoryProductModalOffset,
  inventoryProductModalDragging: _inventoryProductModalDragging,
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
  setStockTypeModalTab: _setStockTypeModalTab,
  createInventoryMappingForm,
  decodeInventoryCategoryMeta,
  titleCaseWords,
  formatVatPercent,
  resolveMainStockValueFromForm: _resolveMainStockValueFromForm,
  handleEditProduct,
  handleDeleteProduct,
  handleEditInventoryCatalogProduct,
  handleDeleteInventoryCatalogProduct,
  loadStockLedger,
  resetInventoryProductForm,
  handleCreateInventoryCatalogProduct,
  handleInventoryProductModalDragStart: _handleInventoryProductModalDragStart,
  resetInventoryMappingForm,
  handleCreateProduct,
  handleInventoryModalDragStart: _handleInventoryModalDragStart,
}) {
  const invColCount = 13
  const [inventoryView, setInventoryView] = useState('items')
  const {
    scrollRef: invScrollRef,
    enabled: invVirtEnabled,
    virtualItems: invVirtualItems,
    paddingTop: invPadTop,
    paddingBottom: invPadBottom,
  } = useVirtualTableRows(sortedInventoryTableRows.length, { estimateSize: 44 })

  const productChrome = useFloatingModalChrome({
    open: showInventoryProductModal,
    persistKey: 'erp-inventory-product',
    defaultWidth: 680,
    defaultHeightRatio: 0.48,
    minWidth: 480,
    minHeight: 300,
    maxHeight: 560,
  })
  const mappingChrome = useFloatingModalChrome({
    open: showInventoryMappingModal,
    persistKey: 'erp-inventory-stock-type',
    defaultWidth: 520,
    defaultHeightRatio: 0.62,
    minWidth: 400,
    minHeight: 360,
    maxHeight: 900,
  })
  const invInputStyle = {
    ...modalInputStyle,
    marginBottom: 0,
    border: `1px solid ${INV_MODAL.inputBorder}`,
    background: INV_MODAL.inputBg,
    borderRadius: INV_MODAL.inputRadius,
  }
  void _stockTypeModalTab
  void _setStockTypeModalTab
  void _resolveMainStockValueFromForm
  void _inventoryModalOffset
  void _inventoryModalDragging
  void _inventoryProductModalOffset
  void _inventoryProductModalDragging
  void _handleInventoryProductModalDragStart
  void _handleInventoryModalDragStart

  const inventoryCurrencyCodes = (() => {
    const rows = Array.isArray(currencies) && currencies.length
      ? currencies.filter((c) => c?.isActive !== false)
      : [{ code: baseCurrencyCode || 'USD' }]
    return [...new Set(rows.map((c) => String(c?.code || '').trim().toUpperCase()).filter(Boolean))]
  })()
  const inventoryPriceCurrency = (() => {
    const current = String(inventoryMappingForm?.priceCurrency || '').trim().toUpperCase()
    return inventoryCurrencyCodes.includes(current)
      ? current
      : (inventoryCurrencyCodes[0] || baseCurrencyCode || 'USD')
  })()
  const useLivePrice = Boolean(inventoryMappingForm?.useLivePrice)
  const mappingLiveMetalKey = resolveLiveMetalKey(
    inventoryMappingForm?.mainStock || inventoryMappingForm?.metalType,
  )

  useEffect(() => {
    if (!showInventoryMappingModal || !useLivePrice || !mappingLiveMetalKey) return undefined
    const livePrice = resolveLiveInventoryUnitCost(
      inventoryMappingForm.mainStock || inventoryMappingForm.metalType,
      liveMetalSnapshot,
      inventoryMappingForm.priceUnit || 'OZ',
    )
    if (!livePrice) return undefined
    const nextPrice = livePrice.toFixed(4)
    const nextCurrency = String(liveMetalSnapshot?.currency || inventoryMappingForm.priceCurrency || 'USD').toUpperCase()
    setInventoryMappingForm((prev) => {
      if (!prev.useLivePrice) return prev
      if (prev.currentPrice === nextPrice && String(prev.priceCurrency || '').toUpperCase() === nextCurrency) return prev
      return { ...prev, currentPrice: nextPrice, priceCurrency: nextCurrency }
    })
    return undefined
  }, [
    showInventoryMappingModal,
    useLivePrice,
    mappingLiveMetalKey,
    liveMetalSnapshot,
    inventoryMappingForm?.mainStock,
    inventoryMappingForm?.metalType,
    inventoryMappingForm?.priceUnit,
    inventoryMappingForm?.priceCurrency,
    setInventoryMappingForm,
  ])

  const stockTypeByMetal = (() => {
    const map = {}
    for (const item of inventoryMappingProducts || []) {
      const meta = decodeInventoryCategoryMeta(item.category)
      const metal = titleCaseWords(meta.mainStock || meta.metalType || item.name || 'Unmapped')
      if (!map[metal]) map[metal] = []
      map[metal].push({ item, meta })
    }
    return map
  })()

  const inventoryGroupedSections = (() => {
    const metalKeys = new Set([
      ...Object.keys(stockTypeByMetal || {}),
      ...Object.keys(inventoryProductsByMetal || {}),
      ...(inventoryMetalBreakdown || []).map((row) => row.metal),
    ])
    const breakdownByMetal = Object.fromEntries(
      (inventoryMetalBreakdown || []).map((row) => [row.metal, row]),
    )
    const preferredMetalOrder = ['Gold', 'Silver', 'Alloy', 'Copper', 'Cadmium', 'Platinum', 'Palladium']
    const metalRank = (metal) => {
      const idx = preferredMetalOrder.findIndex((name) => name.toLowerCase() === String(metal || '').toLowerCase())
      return idx === -1 ? preferredMetalOrder.length : idx
    }
    return [...metalKeys]
      .filter(Boolean)
      .sort((a, b) => {
        const rankDiff = metalRank(a) - metalRank(b)
        if (rankDiff !== 0) return rankDiff
        return String(a).localeCompare(String(b))
      })
      .map((metal) => {
        const products = inventoryProductsByMetal?.[metal] || []
        const stockTypes = stockTypeByMetal?.[metal] || []
        const breakdown = breakdownByMetal[metal] || null
        const totalOnHand = breakdown
          ? Number(breakdown.totalQty || 0)
          : products.reduce((sum, entry) => sum + Math.max(0, Number(entry?.row?.quantity ?? entry?.item?.quantity ?? 0)), 0)
        const totalValue = breakdown
          ? Number(breakdown.totalValue || 0)
          : products.reduce((sum, entry) => sum + Number(entry?.row?.bookStockValue ?? entry?.row?.stockValue ?? 0), 0)
        return {
          metal,
          stockTypes,
          products,
          totalOnHand,
          totalValue,
          productCount: breakdown?.productCount ?? products.length,
          lowStockCount: breakdown?.lowStockCount ?? 0,
        }
      })
  })()

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

  const switchInventoryView = (nextView) => {
    setInventoryView(nextView)
    if (nextView === 'movements' && typeof loadStockLedger === 'function') {
      loadStockLedger()
    }
  }

  return (
  <>
      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Inventory Workspace</h3>
              <p style={{ margin: '0.35rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>
                {inventoryView === 'items'
                  ? 'Stock types with their products and on-hand totals, grouped by metal.'
                  : 'Every inventory change from posted sale/purchase vouchers — full audit trail.'}
              </p>
            </div>
            {inventoryView === 'items' ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={openCreateStockType}
                  style={{ padding: '0.55rem 0.95rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  + Create Stock Type
                </button>
                <button
                  type="button"
                  onClick={openCreateProduct}
                  style={{ padding: '0.55rem 0.95rem', background: '#B45309', color: '#fff', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  + Create Product
                </button>
                <button
                  type="button"
                  onClick={loadInventory}
                  style={{ padding: '0.55rem 0.95rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  Refresh Inventory
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={loadStockLedger}
                  style={{ padding: '0.55rem 0.95rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  {stockMovementsLoading ? 'Loading…' : 'Refresh History'}
                </button>
              </div>
            )}
          </div>

          <div className="voucher-type-bar" role="tablist" aria-label="Inventory views" style={{ marginBottom: '1rem' }}>
            {INVENTORY_VIEW_TABS.map((tab) => {
              const active = inventoryView === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'voucher-type-card active' : 'voucher-type-card'}
                  onClick={() => switchInventoryView(tab.id)}
                >
                  <span className="voucher-type-card-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>

          {inventoryView === 'items' && (
          <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
            <div style={{ border: `1px solid ${C.p2}`, background: C.p1, borderRadius: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Stock Types</p>
              <p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryMappingProducts.length}</p>
            </div>
            <div style={{ border: `1px solid ${C.p2}`, background: C.p1, borderRadius: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Products</p>
              <p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryCatalogProducts.length}</p>
            </div>
            <div style={{ border: `1px solid ${C.p2}`, background: C.p1, borderRadius: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Gross Stock Left</p>
              <p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryTotalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div style={{ border: `1px solid ${C.p2}`, background: C.p1, borderRadius: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Inventory Value (Book)</p>
              <p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{formatAmount(inventoryTotalValue, { currencyCode: baseCurrencyCode })}</p>
              {Number(inventoryTotalLiveValue || 0) > 0 && Math.abs(Number(inventoryTotalLiveValue) - Number(inventoryTotalValue || 0)) > 0.009 ? (
                <p style={{ margin: '0.15rem 0 0', color: '#1D4ED8', fontSize: '0.68rem', fontWeight: '600' }}>
                  Live spot: {formatAmount(inventoryTotalLiveValue, { currencyCode: baseCurrencyCode })}
                </p>
              ) : null}
            </div>
            <div style={{ border: `1px solid ${C.p2}`, background: C.p1, borderRadius: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Low / Zero Stock</p>
              <p style={{ margin: '0.22rem 0 0', color: inventoryLowStockCount > 0 ? '#B45309' : C.ink, fontWeight: '800' }}>{inventoryLowStockCount}</p>
            </div>
          </div>

          <div className="erp-inventory-metal-grid">
            {inventoryGroupedSections.map((section) => {
              const primaryStock = section.stockTypes[0] || null
              const liveMetalKey = resolveLiveMetalKey(
                primaryStock?.meta?.mainStock || primaryStock?.meta?.metalType || section.metal,
              )
              return (
                <section
                  key={section.metal}
                  className="erp-inventory-metal-card"
                  style={{ background: C.p1, border: `1px solid ${C.p2}` }}
                >
                  <div className="erp-inventory-metal-card__header">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, color: C.ink, fontSize: '0.95rem', fontWeight: '800' }}>{section.metal}</h4>
                        <span style={{ padding: '0.12rem 0.4rem', borderRadius: '999px', background: C.softBg, color: C.link, fontWeight: '700', fontSize: '0.66rem' }}>
                          {section.productCount} product{section.productCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.25rem', minHeight: '1.15rem' }}>
                        {liveMetalKey ? (
                          <StockTypeLivePrice
                            metalKey={liveMetalKey}
                            snapshot={liveMetalSnapshot}
                            error={liveMetalError}
                          />
                        ) : null}
                      </div>
                      <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.7rem' }}>
                        Stock type{section.stockTypes.length === 1 ? '' : 's'}: {section.stockTypes.length || 'none'}
                        {section.lowStockCount > 0 ? ` · Low ${section.lowStockCount}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="erp-inventory-metal-card__total-label">Total on hand</div>
                      <div className="erp-inventory-metal-card__total-qty" style={{ color: C.ink }}>
                        {section.totalOnHand.toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                      </div>
                      <div className="erp-inventory-metal-card__total-value">
                        {formatAmount(section.totalValue, { currencyCode: baseCurrencyCode })}
                      </div>
                    </div>
                  </div>

                  <div className="erp-inventory-metal-card__mapping">
                    {section.stockTypes.length > 0 ? section.stockTypes.map(({ item, meta }) => (
                      <div
                        key={item._id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          border: `1px solid ${C.p2}`,
                          background: '#FFFFFF',
                          borderRadius: '0.4rem',
                          padding: '0.2rem 0.35rem',
                          maxWidth: '100%',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.7rem' }}>
                          {titleCaseWords(meta.mainStock || meta.metalType || item.name)}
                        </span>
                        <button type="button" className="erp-inventory-action-btn erp-inventory-action-btn--edit" onClick={() => handleEditProduct(item)}>Edit</button>
                        {(isSuperAdmin || isFinance) && (
                          <button type="button" className="erp-inventory-action-btn erp-inventory-action-btn--delete" onClick={() => handleDeleteProduct(item)}>Delete</button>
                        )}
                      </div>
                    )) : (
                      <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>
                        No stock type yet. Use + Create Stock Type.
                      </div>
                    )}
                  </div>

                  <div className="erp-inventory-metal-card__products">
                    {section.products.length ? section.products.map(({ item, meta, row }) => {
                      const qty = Number(row?.quantity ?? item.quantity ?? 0)
                      const bookValue = Number(row?.bookStockValue ?? row?.stockValue ?? 0)
                      const unitRaw = String(item.unit || 'g').trim()
                      const unitLabel = /^(grams?|gms?)$/i.test(unitRaw) ? 'g' : (unitRaw || 'g')
                      return (
                        <div key={item._id} className="erp-inventory-product-row">
                          <div className="erp-inventory-product-row__main">
                            <div className="erp-inventory-product-row__name" style={{ color: C.ink }} title={item.name}>{item.name}</div>
                            <div className="erp-inventory-product-row__meta" title={`Purity ${meta.productPurity || meta.purity || '-'} · VAT ${formatVatPercent(meta.vatPercent)}`}>
                              Purity {meta.productPurity || meta.purity || '-'}
                              {' · '}VAT {formatVatPercent(meta.vatPercent)}
                            </div>
                          </div>
                          <div className="erp-inventory-product-row__right">
                            <div className="erp-inventory-product-row__qty">
                              <div className="erp-inventory-product-row__qty-value" style={{ color: C.ink }}>
                                {qty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {unitLabel}
                              </div>
                              <div className="erp-inventory-product-row__qty-book">
                                {formatAmount(bookValue, { currencyCode: baseCurrencyCode })}
                              </div>
                            </div>
                            <div className="erp-inventory-product-row__actions">
                              <button type="button" className="erp-inventory-action-btn erp-inventory-action-btn--edit" onClick={() => handleEditInventoryCatalogProduct(item, meta)}>Edit</button>
                              {(isSuperAdmin || isFinance) && (
                                <button type="button" className="erp-inventory-action-btn erp-inventory-action-btn--delete" onClick={() => handleDeleteInventoryCatalogProduct(item)}>Delete</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }) : (
                      <div style={{ border: '1px dashed #CBD5E1', borderRadius: '0.4rem', padding: '0.55rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                        No products yet.
                      </div>
                    )}
                  </div>
                </section>
              )
            })}

            {!inventoryGroupedSections.length && (
              <div style={{ gridColumn: '1 / -1', border: `1px dashed ${C.p2}`, borderRadius: '0.6rem', padding: '1rem', color: C.inkSoft, fontSize: '0.85rem' }}>
                No stock types or products yet. Create a stock type, then add products under it.
              </div>
            )}
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
                  <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Inventory Items</p>
                  <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Book unit cost and value match stock GL. Live spot (blue) is market MTM only.</p>
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
              <div ref={invScrollRef} className="erp-table-wrap" style={{ overflow: 'auto', maxHeight: invVirtEnabled ? 520 : undefined, border: 'none', borderRadius: 0 }}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      {['SKU', 'Name', 'Category', 'Tax Type', 'VAT %', 'Qty On Hand (Gross)', 'Pure Qty', 'Unit', 'Unit Cost (Book)', 'Selling Price', 'Total Value (Book)', 'Min Stock', 'Status'].map(col => {
                        const isVatCol = col === 'VAT %'
                        const vatSortIndicator = inventoryVatSortDir === 'none' ? '' : inventoryVatSortDir === 'asc' ? ' ▲' : ' ▼'
                        const isNum = col === 'VAT %' || col === 'Qty On Hand (Gross)' || col === 'Pure Qty' || col === 'Unit Cost (Book)' || col === 'Selling Price' || col === 'Total Value (Book)'
                        return (
                          <th
                            key={col}
                            className={isNum ? 'num' : undefined}
                            onClick={isVatCol ? () => setInventoryVatSortDir((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')) : undefined}
                            title={isVatCol ? 'Click to sort VAT %' : undefined}
                            style={{
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
                    {invVirtEnabled && invPadTop > 0 && (
                      <tr><td colSpan={invColCount} style={{ height: invPadTop, padding: 0, border: 'none' }} /></tr>
                    )}
                    {(invVirtEnabled
                      ? invVirtualItems.map((vi) => sortedInventoryTableRows[vi.index]).filter(Boolean)
                      : sortedInventoryTableRows
                    ).map(({ item, categoryMeta, productMeta, reportRow }) => {
                      const displayQty = Math.max(0, Number(item.quantity || 0))
                      const zeroStock = displayQty <= 0
                      const lowStock = zeroStock || (Number(item.minThreshold || 0) > 0 && displayQty <= Number(item.minThreshold || 0))
                      const bookUnitCost = Number(reportRow?.storedUnitCost ?? reportRow?.unitCost ?? item.unitCost ?? 0)
                      const bookValue = Number(reportRow?.bookStockValue ?? (displayQty * bookUnitCost))
                      const usesLivePrice = Boolean(reportRow?.usesLivePrice)
                      const liveUnitCost = Number(reportRow?.liveUnitCost || 0)
                      const liveValue = Number(reportRow?.liveStockValue || 0)
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #F1F5F9', background: lowStock ? '#FFF7ED' : undefined, contentVisibility: 'auto', containIntrinsicSize: 'auto 44px' }}>
                          <td style={{ padding: '0.5rem 0.7rem', color: '#6B7280', fontFamily: 'monospace' }}>{item.sku || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', fontWeight: '600', color: C.ink }}>{item.name}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{item.category ? (categoryMeta.mainStock || item.category).slice(0, 30) : '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{productMeta.taxType || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft, fontSize: '0.78rem' }}>{formatVatPercent(productMeta.vatPercent)}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: lowStock ? '#B45309' : '#065F46' }}>{displayQty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(reportRow?.pureStockQty || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft }}>{item.unit || 'pcs'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }} title="Book unit cost (matches stock GL)">
                            <div>{bookUnitCost.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                            {usesLivePrice ? (
                              <div style={{ color: '#1D4ED8', fontSize: '0.68rem', fontWeight: '600' }} title="Live spot price">
                                Live {liveUnitCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(item.sellingPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: C.ink }} title="Book value = qty × book unit cost">
                            <div>{formatAmount(bookValue, { currencyCode: baseCurrencyCode })}</div>
                            {usesLivePrice ? (
                              <div style={{ color: '#1D4ED8', fontSize: '0.68rem', fontWeight: '600' }}>
                                Live {formatAmount(liveValue, { currencyCode: baseCurrencyCode })}
                              </div>
                            ) : null}
                          </td>
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
                    {invVirtEnabled && invPadBottom > 0 && (
                      <tr><td colSpan={invColCount} style={{ height: invPadBottom, padding: 0, border: 'none' }} /></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
          )}

          {inventoryView === 'movements' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Stock Movement History</p>
                <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Filter by item, reason, or actor.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Search item or reason..."
                  value={stockMovementsFilter}
                  onChange={e => setStockMovementsFilter(e.target.value)}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid #D1D5DB', borderRadius: '0.4rem', fontSize: '0.82rem', minWidth: '180px' }}
                />
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
                    <div className="erp-table-wrap" style={{ overflowX: 'auto', borderRadius: '0.45rem' }}>
                      <table className="erp-table">
                        <thead>
                          <tr>
                            {['Date', 'Item', 'Change', 'Before', 'After', 'Reason (Voucher)', 'By'].map(col => (
                              <th key={col} className={col === 'Change' || col === 'Before' || col === 'After' ? 'num' : undefined}>{col}</th>
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
          )}

          {showInventoryProductModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: (productChrome.isDragging || productChrome.isResizing)
                  ? 'rgba(17,24,39,0.18)'
                  : 'rgba(17,24,39,0.45)',
                zIndex: 1210,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && productChrome.canCloseOnBackdropClick()) resetInventoryProductForm()
              }}
            >
              <form
                ref={productChrome.panelRef}
                onSubmit={handleCreateInventoryCatalogProduct}
                style={{
                  position: 'relative',
                  width: productChrome.size.width,
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: productChrome.size.height,
                  background: INV_MODAL.cardBg,
                  border: `1px solid ${INV_MODAL.cardBorder}`,
                  borderRadius: INV_MODAL.radius,
                  padding: 0,
                  boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transform: `translate(${productChrome.offset.x}px, ${productChrome.offset.y}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    backgroundColor: INV_MODAL.headerBg,
                    color: INV_MODAL.headerFg,
                    padding: '1rem 1.25rem',
                    cursor: productChrome.isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                  onMouseDown={productChrome.beginDrag}
                >
                  <div>
                    <p style={{ margin: 0, color: INV_MODAL.headerFg, fontWeight: 800, fontSize: '1.08rem' }}>
                      {editingInventoryProductId ? 'Edit Product' : 'Product Creation'}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', color: INV_MODAL.headerMuted, fontSize: '0.76rem' }}>
                      All product fields in one place — purity weight is automatic.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={resetInventoryProductForm}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      border: 'none',
                      borderRadius: '0.45rem',
                      background: INV_MODAL.closeBtnBg,
                      color: INV_MODAL.headerFg,
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: '0.85rem 1.1rem', background: INV_MODAL.bodyBg, overflow: 'auto', flex: 1, minHeight: 0 }}>
                  <div style={{ background: INV_MODAL.cardBg, border: `1px solid ${INV_MODAL.cardBorder}`, borderRadius: INV_MODAL.radius, padding: '0.85rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.55rem' }}>
                      <div>
                        <label style={invFieldLabel}>Product Category</label>
                        <select
                          value={inventoryProductForm.stockTypeId}
                          onChange={(e) => {
                            const option = inventoryStockTypeOptions.find((item) => item.id === e.target.value)
                            setInventoryProductForm((prev) => ({
                              ...prev,
                              stockTypeId: e.target.value,
                              categoryName: option?.mainStock || '',
                              purity: option?.purity || '',
                            }))
                          }}
                          style={invInputStyle}
                        >
                          <option value="">Select category</option>
                          {inventoryStockTypeOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={invFieldLabel}>Product Name</label>
                        <input
                          placeholder="e.g. 22K Coin"
                          value={inventoryProductForm.name}
                          onChange={(e) => {
                            const nextName = e.target.value
                            setInventoryProductForm((prev) => {
                              const nextPurity = sanitizeCatalogProductPurity({
                                productName: nextName,
                                productPurity: prev.purity,
                              })
                              const shouldAutofill = nextPurity
                                && (
                                  !String(prev.purity || '').trim()
                                  || String(prev.purity).trim() === '1'
                                  || String(prev.purity).trim() === '1.0'
                                )
                              return {
                                ...prev,
                                name: nextName,
                                ...(shouldAutofill ? { purity: nextPurity } : {}),
                              }
                            })
                          }}
                          style={invInputStyle}
                        />
                      </div>
                      <div>
                        <label style={invFieldLabel}>Weight</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0"
                          value={inventoryProductForm.weight}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, weight: e.target.value }))}
                          style={invInputStyle}
                        />
                      </div>
                      <div>
                        <label style={invFieldLabel}>Gross Weight</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0"
                          value={inventoryProductForm.grossWeight}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, grossWeight: e.target.value }))}
                          style={invInputStyle}
                        />
                      </div>
                      <div>
                        <label style={invFieldLabel}>Purity</label>
                        <input
                          placeholder="e.g. 0.917"
                          value={inventoryProductForm.purity}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, purity: e.target.value }))}
                          style={invInputStyle}
                        />
                      </div>
                      <div>
                        <label style={invFieldLabel}>Purity Weight</label>
                        <input
                          value={inventoryProductPurityWeight
                            ? inventoryProductPurityWeight.toLocaleString(undefined, { maximumFractionDigits: 4 })
                            : ''}
                          readOnly
                          placeholder="Auto"
                          style={{
                            ...invInputStyle,
                            background: INV_MODAL.inputReadonlyBg,
                            color: '#64748B',
                          }}
                        />
                      </div>
                      <div>
                        <label style={invFieldLabel}>Tax Type</label>
                        <select
                          value={inventoryProductForm.taxType}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, taxType: e.target.value }))}
                          style={invInputStyle}
                        >
                          <option value="VAT">VAT</option>
                          <option value="GST">GST</option>
                          <option value="Sales Tax">Sales Tax</option>
                          <option value="None">None</option>
                        </select>
                      </div>
                      <div>
                        <label style={invFieldLabel}>VAT %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={inventoryProductForm.vatPercent}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, vatPercent: e.target.value }))}
                          style={invInputStyle}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={invFieldLabel}>Description</label>
                        <input
                          placeholder="Optional description"
                          value={inventoryProductForm.description}
                          onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, description: e.target.value }))}
                          style={invInputStyle}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{
                  background: INV_MODAL.footerBg,
                  borderTop: `1px solid ${INV_MODAL.cardBorder}`,
                  padding: `0.65rem ${FLOATING_MODAL_FOOTER_END_PAD} 0.65rem 1.1rem`,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.55rem',
                  flexShrink: 0,
                }}
                >
                  <button
                    type="button"
                    onClick={resetInventoryProductForm}
                    style={{
                      padding: '0.5rem 1rem',
                      background: INV_MODAL.cancelBg,
                      color: INV_MODAL.cancelFg,
                      border: '1px solid #D1D5DB',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleCreateInventoryCatalogProduct({ preventDefault: () => e.preventDefault() })}
                    style={{
                      padding: '0.5rem 1rem',
                      background: INV_MODAL.primaryBg,
                      color: INV_MODAL.primaryFg,
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: saving ? 'wait' : 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      opacity: saving ? 0.75 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : editingInventoryProductId ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
                <FloatingModalResizeHandle onMouseDown={productChrome.beginResize} />
              </form>
            </div>
          )}

          {showInventoryMappingModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: (mappingChrome.isDragging || mappingChrome.isResizing)
                  ? 'rgba(17,24,39,0.18)'
                  : 'rgba(17,24,39,0.45)',
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && mappingChrome.canCloseOnBackdropClick()) resetInventoryMappingForm()
              }}
            >
              <form
                ref={mappingChrome.panelRef}
                onSubmit={handleCreateProduct}
                style={{
                  position: 'relative',
                  width: mappingChrome.size.width,
                  height: mappingChrome.size.height,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  overflow: 'hidden',
                  background: INV_MODAL.cardBg,
                  border: `1px solid ${INV_MODAL.cardBorder}`,
                  borderRadius: INV_MODAL.radius,
                  boxShadow: '0 20px 42px rgba(0,0,0,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  transform: `translate(${mappingChrome.offset.x}px, ${mappingChrome.offset.y}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    backgroundColor: INV_MODAL.headerBg,
                    color: INV_MODAL.headerFg,
                    cursor: mappingChrome.isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                  onMouseDown={mappingChrome.beginDrag}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, color: INV_MODAL.headerFg, fontSize: '1.08rem' }}>
                      {editingProductId ? 'Edit Stock Type' : 'Stock Type Creation'}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', color: INV_MODAL.headerMuted, fontSize: '0.8rem' }}>
                      Metal type, live or manual price, unit, and currency.
                    </p>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={resetInventoryMappingForm}
                    aria-label="Close"
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      background: INV_MODAL.closeBtnBg,
                      color: INV_MODAL.headerFg,
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: '1rem 1.25rem', background: INV_MODAL.bodyBg, overflow: 'auto', flex: 1, minHeight: 0 }}>
                  <div style={{ display: 'grid', gap: '0.85rem', maxWidth: 480 }}>
                    <div style={{ background: INV_MODAL.cardBg, border: `1px solid ${INV_MODAL.cardBorder}`, borderRadius: INV_MODAL.radius, padding: '1rem' }}>
                      <label style={invFieldLabel}>Metal type</label>
                      <input
                        placeholder="e.g. Gold, Silver, Platinum"
                        value={inventoryMappingForm.mainStock}
                        onChange={(e) => {
                          const val = e.target.value
                          setInventoryMappingForm((prev) => ({ ...prev, mainStock: val, metalType: val.trim().toLowerCase() }))
                        }}
                        style={invInputStyle}
                      />
                    </div>

                    <div style={{ background: INV_MODAL.cardBg, border: `1px solid ${INV_MODAL.cardBorder}`, borderRadius: INV_MODAL.radius, padding: '1rem' }}>
                      <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: '#111827', fontWeight: 700 }}>Current Price</p>
                      {mappingLiveMetalKey ? (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <StockTypeLivePrice
                            metalKey={mappingLiveMetalKey}
                            snapshot={liveMetalSnapshot}
                            error={liveMetalError}
                            align="left"
                          />
                        </div>
                      ) : (
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>
                          Live price is available for Gold, Silver, or Platinum metal types.
                        </p>
                      )}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.75rem',
                          fontSize: '0.8rem',
                          color: '#111827',
                          fontWeight: 600,
                          cursor: mappingLiveMetalKey ? 'pointer' : 'not-allowed',
                          opacity: mappingLiveMetalKey ? 1 : 0.55,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={useLivePrice}
                          disabled={!mappingLiveMetalKey}
                          onChange={(e) => {
                            const checked = e.target.checked
                            if (!checked) {
                              setInventoryMappingForm((prev) => ({ ...prev, useLivePrice: false }))
                              return
                            }
                            const livePrice = resolveLiveInventoryUnitCost(
                              inventoryMappingForm.mainStock || inventoryMappingForm.metalType,
                              liveMetalSnapshot,
                              inventoryMappingForm.priceUnit || 'OZ',
                            )
                            setInventoryMappingForm((prev) => ({
                              ...prev,
                              useLivePrice: true,
                              ...(livePrice
                                ? {
                                  currentPrice: livePrice.toFixed(4),
                                  priceCurrency: liveMetalSnapshot?.currency || prev.priceCurrency || 'USD',
                                }
                                : {}),
                            }))
                          }}
                        />
                        Use live price
                      </label>
                      <label style={{ ...invFieldLabel, marginBottom: '0.35rem' }}>
                        Price{useLivePrice ? ' (from live spot)' : ' (manual)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={useLivePrice ? 'Filled from live spot' : 'Enter price'}
                        value={inventoryMappingForm.currentPrice}
                        readOnly={useLivePrice}
                        onChange={(e) => {
                          if (useLivePrice) return
                          setInventoryMappingForm((prev) => ({ ...prev, currentPrice: e.target.value, useLivePrice: false }))
                        }}
                        style={{
                          ...invInputStyle,
                          marginBottom: '0.75rem',
                          background: useLivePrice ? INV_MODAL.inputReadonlyBg : INV_MODAL.inputBg,
                          color: useLivePrice ? '#64748B' : undefined,
                          cursor: useLivePrice ? 'default' : 'text',
                        }}
                      />
                      <label style={{ ...invFieldLabel, marginBottom: '0.35rem' }}>Unit</label>
                      <select
                        value={inventoryMappingForm.priceUnit}
                        onChange={(e) => setInventoryMappingForm((prev) => ({ ...prev, priceUnit: e.target.value }))}
                        style={{ ...invInputStyle, marginBottom: '0.75rem' }}
                      >
                        <option value="OZ">Per OZ (Troy)</option>
                        <option value="GRAM">Per Gram</option>
                        <option value="KG">Per KG</option>
                      </select>
                      <label style={{ ...invFieldLabel, marginBottom: '0.35rem' }}>Currency</label>
                      <select
                        value={inventoryPriceCurrency}
                        disabled={useLivePrice}
                        onChange={(e) => {
                          if (useLivePrice) return
                          setInventoryMappingForm((prev) => ({ ...prev, priceCurrency: e.target.value }))
                        }}
                        style={{
                          ...invInputStyle,
                          background: useLivePrice ? INV_MODAL.inputReadonlyBg : INV_MODAL.inputBg,
                          color: useLivePrice ? '#64748B' : undefined,
                        }}
                      >
                        {inventoryCurrencyCodes.map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.65rem',
                  justifyContent: 'flex-end',
                  padding: `0.85rem ${FLOATING_MODAL_FOOTER_END_PAD} 0.85rem 1.25rem`,
                  flexShrink: 0,
                  borderTop: `1px solid ${INV_MODAL.cardBorder}`,
                  background: INV_MODAL.footerBg,
                }}
                >
                  <button
                    type="button"
                    onClick={resetInventoryMappingForm}
                    style={{
                      padding: '0.6rem 1.15rem',
                      background: INV_MODAL.cancelBg,
                      color: INV_MODAL.cancelFg,
                      border: '1px solid #D1D5DB',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '0.6rem 1.15rem',
                      background: INV_MODAL.primaryBg,
                      color: INV_MODAL.primaryFg,
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: saving ? 'wait' : 'pointer',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : editingProductId ? 'Save Stock Type' : 'Create Stock Type'}
                  </button>
                </div>
                <FloatingModalResizeHandle onMouseDown={mappingChrome.beginResize} />
              </form>
            </div>
          )}
        </div>
      )}
    </>
  )
}
