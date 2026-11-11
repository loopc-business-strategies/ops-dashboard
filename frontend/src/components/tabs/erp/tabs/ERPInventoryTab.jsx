import { Fragment, useEffect, useState } from 'react'
import StockTypeLivePrice from '../../../StockTypeLivePrice'
import { resolveLiveMetalKey, resolveLiveInventoryUnitCost } from '../../../../utils/liveMetalRates'
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
  isSuperAdmin: _isSuperAdmin,
  isFinance: _isFinance,
  saving,
  token: _token,
  tenantKey: _tenantKey,
  liveMetalSnapshot = null,
  liveMetalError = null,
  loadInventory,
  inventoryMappingProducts: _inventoryMappingProducts,
  inventoryCatalogProducts: _inventoryCatalogProducts,
  inventoryProductsByMetal: _inventoryProductsByMetal,
  inventoryReportProducts: _inventoryReportProducts,
  inventoryTotalQuantity: _inventoryTotalQuantity,
  inventoryTotalValue: _inventoryTotalValue,
  inventoryTotalLiveValue: _inventoryTotalLiveValue,
  inventoryLowStockCount: _inventoryLowStockCount,
  inventoryMetalBreakdown: _inventoryMetalBreakdown,
  inventoryTopProducts: _inventoryTopProducts,
  legacyInventoryProducts,
  inventoryVatFilter: _inventoryVatFilter,
  inventoryVatSortDir: _inventoryVatSortDir,
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
  setInventoryVatFilter: _setInventoryVatFilter,
  setInventoryVatSortDir: _setInventoryVatSortDir,
  setStockMovementsFilter,
  setInventoryProductForm,
  setStockTypeModalTab: _setStockTypeModalTab,
  createInventoryMappingForm,
  decodeInventoryCategoryMeta: _decodeInventoryCategoryMeta,
  titleCaseWords,
  formatVatPercent: _formatVatPercent,
  resolveMainStockValueFromForm: _resolveMainStockValueFromForm,
  handleEditProduct: _handleEditProduct,
  handleDeleteProduct: _handleDeleteProduct,
  handleEditInventoryCatalogProduct: _handleEditInventoryCatalogProduct,
  handleDeleteInventoryCatalogProduct: _handleDeleteInventoryCatalogProduct,
  loadStockLedger,
  resetInventoryProductForm,
  handleCreateInventoryCatalogProduct,
  handleInventoryProductModalDragStart: _handleInventoryProductModalDragStart,
  resetInventoryMappingForm,
  handleCreateProduct,
  handleInventoryModalDragStart: _handleInventoryModalDragStart,
}) {
  const invColCount = 6
  const [inventoryView, setInventoryView] = useState('items')
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all')
  const [inventoryItemSearch, setInventoryItemSearch] = useState('')
  const [includeZeroQty, setIncludeZeroQty] = useState(false)
  const [movementsCategoryFilter, setMovementsCategoryFilter] = useState('all')
  const {
    scrollRef: invScrollRef,
  } = useVirtualTableRows(sortedInventoryTableRows.length, { estimateSize: 44 })

  const preferredMetalOrder = ['Gold', 'Silver', 'Alloy', 'Copper', 'Cadmium', 'Platinum', 'Palladium']
  const resolveRowMetal = (row) => {
    const metalRaw = row?.reportRow?.metal
      || row?.categoryMeta?.mainStock
      || row?.categoryMeta?.metalType
      || row?.productMeta?.mainStock
      || row?.productMeta?.metalType
      || row?.item?.category
      || 'Unmapped'
    return titleCaseWords(String(metalRaw).split(/[;|]/)[0].replace(/^mainStock=/i, '').trim() || 'Unmapped')
  }
  const inventoryCategoryOptions = (() => {
    const known = new Set(preferredMetalOrder.map((name) => name.toLowerCase()))
    const present = new Set()
    let hasOther = false
    for (const row of sortedInventoryTableRows || []) {
      const metal = resolveRowMetal(row)
      const key = String(metal || '').toLowerCase()
      if (known.has(key)) present.add(metal)
      else hasOther = true
    }
    const options = preferredMetalOrder
      .filter((name) => present.has(name) || [...present].some((m) => m.toLowerCase() === name.toLowerCase()))
      .map((name) => ({ value: name.toLowerCase(), label: name }))
    if (hasOther) options.push({ value: 'other', label: 'Other' })
    return options
  })()

  const inventoryCategoryGroups = (() => {
    const metalRank = (metal) => {
      const idx = preferredMetalOrder.findIndex((name) => name.toLowerCase() === String(metal || '').toLowerCase())
      return idx === -1 ? preferredMetalOrder.length : idx
    }
    const search = String(inventoryItemSearch || '').trim().toLowerCase()
    const known = new Set(preferredMetalOrder.map((name) => name.toLowerCase()))
    const groups = new Map()
    for (const row of sortedInventoryTableRows || []) {
      const metalKey = resolveRowMetal(row)
      const metalLower = String(metalKey || '').toLowerCase()
      const isOther = !known.has(metalLower)
      if (inventoryCategoryFilter === 'other') {
        if (!isOther) continue
      } else if (inventoryCategoryFilter !== 'all' && metalLower !== inventoryCategoryFilter) {
        continue
      }
      const item = row?.item
      const reportRow = row?.reportRow || {}
      const grossQty = Math.max(0, Number(reportRow.quantity ?? item?.quantity ?? 0))
      if (!includeZeroQty && grossQty <= 0) continue
      if (search) {
        const hay = `${item?.name || ''} ${item?.sku || ''} ${metalKey}`.toLowerCase()
        if (!hay.includes(search)) continue
      }
      if (!groups.has(metalKey)) groups.set(metalKey, [])
      groups.get(metalKey).push(row)
    }
    return [...groups.entries()]
      .sort((a, b) => {
        const rankDiff = metalRank(a[0]) - metalRank(b[0])
        if (rankDiff !== 0) return rankDiff
        return String(a[0]).localeCompare(String(b[0]))
      })
      .map(([metal, rows]) => {
        const products = rows.map((entry) => {
          const item = entry.item
          const productMeta = entry.productMeta || {}
          const reportRow = entry.reportRow || {}
          const grossQty = Math.max(0, Number(reportRow.quantity ?? item?.quantity ?? 0))
          const purityRaw = reportRow.purity || productMeta.productPurity || productMeta.purity || ''
          const pureQty = Math.max(0, Number(reportRow.pureStockQty ?? 0))
          const pcsRaw = productMeta.pcs ?? productMeta.pieces ?? item?.pcs ?? item?.pieces
          const pcs = pcsRaw === '' || pcsRaw == null ? null : Number(pcsRaw)
          return {
            id: item?._id,
            name: item?.name || '—',
            pcs: Number.isFinite(pcs) ? pcs : null,
            grossQty,
            purity: purityRaw,
            pureQty,
          }
        })
        const totalGross = products.reduce((sum, p) => sum + p.grossQty, 0)
        const totalPure = products.reduce((sum, p) => sum + p.pureQty, 0)
        const pcsValues = products.map((p) => p.pcs).filter((n) => n != null && Number.isFinite(n))
        const totalPcs = pcsValues.length
          ? pcsValues.reduce((sum, n) => sum + n, 0)
          : products.length
        const totalPurity = totalGross > 0 ? totalPure / totalGross : null
        return {
          metal,
          metalLabel: String(metal || '').toLowerCase(),
          products,
          totalPcs,
          totalGross,
          totalPurity,
          totalPure,
        }
      })
      .filter((group) => group.products.length > 0)
  })()
  const visibleInventoryItemCount = inventoryCategoryGroups.reduce((sum, group) => sum + group.products.length, 0)

  const inventoryMetalByItemKey = (() => {
    const byId = new Map()
    const byName = new Map()
    for (const row of sortedInventoryTableRows || []) {
      const metal = resolveRowMetal(row)
      const id = String(row?.item?._id || '').trim()
      const name = String(row?.item?.name || '').trim().toLowerCase()
      if (id) byId.set(id, metal)
      if (name) byName.set(name, metal)
    }
    return { byId, byName }
  })()

  const resolveMovementMetal = (movement) => {
    const id = String(movement?.itemId || '').trim()
    if (id && inventoryMetalByItemKey.byId.has(id)) return inventoryMetalByItemKey.byId.get(id)
    const name = String(movement?.itemName || '').trim().toLowerCase()
    if (name && inventoryMetalByItemKey.byName.has(name)) return inventoryMetalByItemKey.byName.get(name)
    return 'Unmapped'
  }

  const stockMovementCategoryGroups = (() => {
    const metalRank = (metal) => {
      const idx = preferredMetalOrder.findIndex((name) => name.toLowerCase() === String(metal || '').toLowerCase())
      return idx === -1 ? preferredMetalOrder.length : idx
    }
    const known = new Set(preferredMetalOrder.map((name) => name.toLowerCase()))
    const search = String(stockMovementsFilter || '').trim().toLowerCase()
    const filtered = (stockMovements || []).filter((m) => {
      const metal = resolveMovementMetal(m)
      const metalLower = String(metal || '').toLowerCase()
      const isOther = !known.has(metalLower)
      if (movementsCategoryFilter === 'other') {
        if (!isOther) return false
      } else if (movementsCategoryFilter !== 'all' && metalLower !== movementsCategoryFilter) {
        return false
      }
      if (!search) return true
      return (
        String(m.itemName || '').toLowerCase().includes(search)
        || String(m.reason || '').toLowerCase().includes(search)
        || String(m.actorName || '').toLowerCase().includes(search)
        || metalLower.includes(search)
      )
    })

    const byMetal = new Map()
    for (const movement of filtered) {
      const metal = resolveMovementMetal(movement)
      if (!byMetal.has(metal)) byMetal.set(metal, new Map())
      const byProduct = byMetal.get(metal)
      const productName = String(movement.itemName || 'Unknown item').trim() || 'Unknown item'
      if (!byProduct.has(productName)) byProduct.set(productName, [])
      byProduct.get(productName).push(movement)
    }

    return [...byMetal.entries()]
      .sort((a, b) => {
        const rankDiff = metalRank(a[0]) - metalRank(b[0])
        if (rankDiff !== 0) return rankDiff
        return String(a[0]).localeCompare(String(b[0]))
      })
      .map(([metal, byProduct]) => {
        const products = [...byProduct.entries()]
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
          .map(([name, movements]) => ({
            name,
            movements: [...movements].sort((a, b) => {
              const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0
              const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0
              return bTime - aTime
            }),
          }))
        return {
          metal,
          metalLabel: String(metal || '').toLowerCase(),
          products,
          movementCount: products.reduce((sum, p) => sum + p.movements.length, 0),
        }
      })
      .filter((group) => group.products.length > 0)
  })()
  const visibleMovementCount = stockMovementCategoryGroups.reduce((sum, group) => sum + group.movementCount, 0)

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
  void _inventoryMappingProducts
  void _inventoryCatalogProducts
  void _inventoryProductsByMetal
  void _inventoryMetalBreakdown
  void _inventoryReportProducts
  void _inventoryTotalQuantity
  void _inventoryTotalValue
  void _inventoryTotalLiveValue
  void _inventoryLowStockCount
  void _handleEditProduct
  void _handleDeleteProduct
  void _handleEditInventoryCatalogProduct
  void _handleDeleteInventoryCatalogProduct
  void _isSuperAdmin
  void _isFinance
  void _decodeInventoryCategoryMeta
  void _formatVatPercent
  void _inventoryVatFilter
  void _inventoryVatSortDir
  void _setInventoryVatFilter
  void _setInventoryVatSortDir

  useEffect(() => {
    if (typeof _setInventoryVatFilter === 'function') _setInventoryVatFilter('all')
  }, [_setInventoryVatFilter])

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
                  ? 'Book unit cost and value match stock GL. Live spot (blue) is market MTM only.'
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
          {legacyInventoryProducts.length > 0 && (
            <p style={{ margin: '0 0 0.8rem', color: '#92400E', fontSize: '0.8rem' }}>
              Legacy inventory records still exist outside the new stock-type/product structure: {legacyInventoryProducts.length}
            </p>
          )}

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Inventory Items</p>
                <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Grouped by metal category — products indented under each category with stock totals.</p>
              </div>
              <span style={{ padding: '0.3rem 0.6rem', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>
                {visibleInventoryItemCount} item{visibleInventoryItemCount === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'nowrap' }}>
              <select
                value={inventoryCategoryFilter}
                onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                aria-label="Category filter"
                style={{
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.4rem',
                  fontSize: '0.78rem',
                  color: C.ink,
                  background: '#FFFFFF',
                  width: '150px',
                  flex: '0 0 auto',
                }}
              >
                <option value="all">All Categories</option>
                {inventoryCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={inventoryItemSearch}
                onChange={(e) => setInventoryItemSearch(e.target.value)}
                placeholder="Search item, SKU, category"
                style={{
                  padding: '0.35rem 0.6rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.4rem',
                  fontSize: '0.78rem',
                  color: C.ink,
                  background: '#FFFFFF',
                  width: '220px',
                  flex: '0 0 auto',
                }}
              />
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.5rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.4rem',
                  fontSize: '0.78rem',
                  color: C.ink,
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontWeight: 600,
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeZeroQty}
                  onChange={(e) => setIncludeZeroQty(e.target.checked)}
                  style={{ margin: 0, width: 'auto' }}
                />
                Include 0
              </label>
            </div>
            {inventoryCategoryGroups.length === 0 ? (
              <div style={{ border: `1px dashed ${C.p2}`, borderRadius: '0.6rem', padding: '1rem', color: C.inkSoft, fontSize: '0.85rem' }}>
                {sortedInventoryTableRows.length === 0
                  ? 'No inventory items yet. Create a stock type, then add products under it.'
                  : includeZeroQty
                    ? 'No items match the current filters.'
                    : 'No non-zero items match. Tick “Include 0” to show zero-qty products.'}
              </div>
            ) : (
              <div ref={invScrollRef} className="erp-table-wrap" style={{ overflow: 'auto', maxHeight: 560, border: 'none', borderRadius: 0 }}>
                <table className="erp-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', minWidth: '7rem' }}>Category</th>
                      <th style={{ textAlign: 'left', minWidth: '12rem' }}>Item</th>
                      <th className="num">pcs</th>
                      <th className="num">gross qty</th>
                      <th className="num">purity</th>
                      <th className="num">pure qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryCategoryGroups.map((group, groupIndex) => (
                      <Fragment key={group.metal}>
                        <tr style={{ background: '#FFF7ED', borderTop: groupIndex > 0 ? '1px solid #E2E8F0' : undefined }}>
                          <td style={{ padding: '0.55rem 0.7rem', fontWeight: 800, color: C.ink, textTransform: 'lowercase', verticalAlign: 'top' }}>
                            {group.metalLabel}
                          </td>
                          <td style={{ padding: '0.55rem 0.7rem' }} />
                          <td style={{ padding: '0.55rem 0.7rem' }} />
                          <td style={{ padding: '0.55rem 0.7rem' }} />
                          <td style={{ padding: '0.55rem 0.7rem' }} />
                          <td style={{ padding: '0.55rem 0.7rem' }} />
                        </tr>
                        {group.products.map((product) => {
                          const isZero = product.grossQty <= 0
                          return (
                          <tr key={product.id} style={{ borderBottom: '1px solid #F8FAFC', background: isZero ? '#FFFBEB' : undefined }}>
                            <td style={{ padding: '0.4rem 0.7rem' }} />
                            <td style={{ padding: '0.4rem 0.7rem 0.4rem 1.6rem', fontWeight: 600, color: isZero ? '#92400E' : C.ink }}>
                              {product.name}
                              {isZero ? <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 700, color: '#B45309' }}>0 stock</span> : null}
                            </td>
                            <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>
                              {product.pcs == null ? '—' : product.pcs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', color: isZero ? '#B45309' : C.ink, fontWeight: 600 }}>
                              {product.grossQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            </td>
                            <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>
                              {product.purity === '' || product.purity == null ? '—' : String(product.purity)}
                            </td>
                            <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', color: isZero ? '#B45309' : C.ink, fontWeight: 600 }}>
                              {product.pureQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            </td>
                          </tr>
                          )
                        })}
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '0.45rem 0.7rem' }} />
                          <td style={{ padding: '0.45rem 0.7rem 0.45rem 1.6rem', fontWeight: 700, color: C.inkSoft }}>total</td>
                          <td style={{ padding: '0.45rem 0.7rem', textAlign: 'right', fontWeight: 800, color: C.ink }}>
                            {group.totalPcs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: '0.45rem 0.7rem', textAlign: 'right', fontWeight: 800, color: C.ink }}>
                            {group.totalGross.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                          </td>
                          <td style={{ padding: '0.45rem 0.7rem', textAlign: 'right', fontWeight: 700, color: C.inkSoft }}>
                            {group.totalPurity == null ? '—' : group.totalPurity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </td>
                          <td style={{ padding: '0.45rem 0.7rem', textAlign: 'right', fontWeight: 800, color: C.ink }}>
                            {group.totalPure.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                          </td>
                        </tr>
                        <tr aria-hidden="true">
                          <td colSpan={invColCount} style={{ height: '0.55rem', padding: 0, border: 'none' }} />
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
          )}

          {inventoryView === 'movements' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Stock Movement History</p>
                <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Grouped by metal category — products listed under each category.</p>
              </div>
              <span style={{ padding: '0.3rem 0.6rem', background: '#F1F5F9', color: '#475569', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>
                {visibleMovementCount} entr{visibleMovementCount === 1 ? 'y' : 'ies'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'nowrap' }}>
              <select
                value={movementsCategoryFilter}
                onChange={(e) => setMovementsCategoryFilter(e.target.value)}
                aria-label="Movement category filter"
                style={{
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.4rem',
                  fontSize: '0.78rem',
                  color: C.ink,
                  background: '#FFFFFF',
                  width: '150px',
                  flex: '0 0 auto',
                }}
              >
                <option value="all">All Categories</option>
                {inventoryCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search item or reason..."
                value={stockMovementsFilter}
                onChange={(e) => setStockMovementsFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.4rem',
                  fontSize: '0.78rem',
                  color: C.ink,
                  background: '#FFFFFF',
                  width: '220px',
                  flex: '0 0 auto',
                }}
              />
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
                : stockMovementCategoryGroups.length === 0
                  ? (
                    <div style={{ border: `1px dashed ${C.p2}`, borderRadius: '0.6rem', padding: '1rem', color: C.inkSoft, fontSize: '0.85rem' }}>
                      No movements match the current filters.
                    </div>
                  )
                : (
                    <div className="erp-table-wrap" style={{ overflow: 'auto', maxHeight: 560, borderRadius: '0.45rem' }}>
                      <table className="erp-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', minWidth: '7rem' }}>Category</th>
                            <th style={{ textAlign: 'left', minWidth: '11rem' }}>Item</th>
                            <th style={{ textAlign: 'left' }}>Date</th>
                            <th className="num">Change</th>
                            <th className="num">Before</th>
                            <th className="num">After</th>
                            <th style={{ textAlign: 'left' }}>Reason (Voucher)</th>
                            <th style={{ textAlign: 'left' }}>By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockMovementCategoryGroups.map((group, groupIndex) => (
                            <Fragment key={group.metal}>
                              <tr style={{ background: '#FFF7ED', borderTop: groupIndex > 0 ? '1px solid #E2E8F0' : undefined }}>
                                <td style={{ padding: '0.55rem 0.7rem', fontWeight: 800, color: C.ink, textTransform: 'lowercase' }}>
                                  {group.metalLabel}
                                </td>
                                <td colSpan={7} style={{ padding: '0.55rem 0.7rem', color: C.inkSoft, fontSize: '0.74rem', fontWeight: 600 }}>
                                  {group.products.length} product{group.products.length === 1 ? '' : 's'} · {group.movementCount} move{group.movementCount === 1 ? '' : 's'}
                                </td>
                              </tr>
                              {group.products.map((product) => (
                                <Fragment key={`${group.metal}-${product.name}`}>
                                  <tr style={{ background: '#F8FAFC' }}>
                                    <td style={{ padding: '0.35rem 0.7rem' }} />
                                    <td colSpan={7} style={{ padding: '0.35rem 0.7rem 0.35rem 1.4rem', fontWeight: 700, color: C.ink }}>
                                      {product.name}
                                      <span style={{ marginLeft: '0.45rem', color: C.inkSoft, fontWeight: 600, fontSize: '0.72rem' }}>
                                        {product.movements.length} move{product.movements.length === 1 ? '' : 's'}
                                      </span>
                                    </td>
                                  </tr>
                                  {product.movements.map((m, i) => {
                                    const isIn = Number(m.change || 0) > 0
                                    return (
                                      <tr key={m._id || `${product.name}-${i}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '0.4rem 0.7rem' }} />
                                        <td style={{ padding: '0.4rem 0.7rem' }} />
                                        <td style={{ padding: '0.4rem 0.7rem', color: C.inkSoft, whiteSpace: 'nowrap' }}>
                                          {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', fontWeight: 700, color: isIn ? '#166534' : '#B91C1C' }}>
                                          {isIn ? '+' : ''}{Number(m.change || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>
                                          {Number(m.quantityBefore || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.7rem', textAlign: 'right', fontWeight: 600, color: C.ink }}>
                                          {Number(m.quantityAfter || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </td>
                                        <td style={{ padding: '0.4rem 0.7rem' }}>
                                          <span style={{ background: isIn ? '#DCFCE7' : '#FEE2E2', color: isIn ? '#166534' : '#991B1B', borderRadius: '0.3rem', padding: '0.18rem 0.45rem', fontSize: '0.78rem', fontWeight: 600 }}>
                                            {m.reason || '—'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.4rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{m.actorName || '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </Fragment>
                              ))}
                              <tr aria-hidden="true">
                                <td colSpan={8} style={{ height: '0.55rem', padding: 0, border: 'none' }} />
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
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
