import React, { useMemo } from 'react'
import { S, inputStyle, labelStyle, decodeInventoryCategoryMeta, decodeFullMeta } from './voucherTabShared'
import { resolveVoucherLinePurityFromProduct } from './voucherLinePurity'
import {
  computeConservedToGross,
  computePureWeight,
  getTransferSideLine,
  upsertTransferSideLine,
} from './metalTransferCalc'

function catalogProducts(inventoryProducts = []) {
  return (Array.isArray(inventoryProducts) ? inventoryProducts : [])
    .filter((item) => String(item?.category || '').includes('recordType=product'))
    .filter((item) => !item?.isDeleted)
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
}

function resolveProductPurity(product) {
  if (!product) return ''
  const meta = decodeFullMeta(product.category)
  const simMeta = decodeInventoryCategoryMeta(product.category)
  return resolveVoucherLinePurityFromProduct({
    productName: product.name || '',
    productPurity: meta.productPurity || simMeta.purity || '',
  })
}

function SidePanel({
  title,
  side,
  line,
  products,
  formReadOnly,
  grossReadOnly,
  onChangeSide,
}) {
  const productId = String(line.inventoryItemId || '')
  const selected = products.find((p) => String(p._id) === productId) || null

  return (
    <div style={{ border: `1px solid ${S.border}`, background: S.white, flex: 1, minWidth: 280 }}>
      <div style={{
        padding: '0.4rem 0.65rem',
        fontWeight: 700,
        fontSize: '0.78rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: S.headerBg,
        borderBottom: `1px solid ${S.border}`,
        color: S.ink,
      }}
      >
        {title}
      </div>
      <div style={{ padding: '0.75rem', display: 'grid', gap: '0.55rem' }}>
        <div>
          <label style={labelStyle}>Product</label>
          <select
            style={inputStyle}
            disabled={formReadOnly}
            value={productId}
            onChange={(e) => {
              const id = e.target.value
              const product = products.find((p) => String(p._id) === id)
              if (!product) {
                onChangeSide(side, {
                  inventoryItemId: '',
                  productType: '',
                  stockCode: '',
                  purity: '',
                  pureWeight: '',
                })
                return
              }
              const purity = resolveProductPurity(product)
              onChangeSide(side, {
                inventoryItemId: String(product._id),
                productType: product.name || '',
                stockCode: product.sku || '',
                purity,
              })
            }}
          >
            <option value="">Select product (alloy / gold)</option>
            {products.map((p) => (
              <option key={p._id} value={String(p._id)}>
                {p.name}{Number(p.quantity) ? ` — ${Number(p.quantity).toFixed(3)} g` : ''}
              </option>
            ))}
          </select>
          {selected ? (
            <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#64748B' }}>
              On hand: {Number(selected.quantity || 0).toFixed(3)} g
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
          <div>
            <label style={labelStyle}>Purity</label>
            <input style={{ ...inputStyle, background: '#F8FAFC' }} readOnly value={line.purity || ''} />
          </div>
          <div>
            <label style={labelStyle}>Qty (PCS)</label>
            <input
              style={inputStyle}
              type="number"
              step="1"
              disabled={formReadOnly}
              value={line.pcs || ''}
              onChange={(e) => onChangeSide(side, { pcs: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
          <div>
            <label style={labelStyle}>Gross Weight (g)</label>
            <input
              style={{ ...inputStyle, ...(grossReadOnly ? { background: '#F8FAFC' } : {}) }}
              type="number"
              step="0.001"
              disabled={formReadOnly || grossReadOnly}
              readOnly={grossReadOnly}
              value={line.grossWeight || ''}
              onChange={(e) => onChangeSide(side, { grossWeight: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Pure Weight (g)</label>
            <input
              style={{ ...inputStyle, background: '#F8FAFC' }}
              readOnly
              value={line.pureWeight || ''}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * From / To product transfer editor. Conserves pure metal when From gross changes.
 */
export default function MetalTransferEditor({
  lineItems,
  setLineItems,
  inventoryProducts,
  formReadOnly,
  loadingInventoryProducts,
}) {
  const products = useMemo(() => catalogProducts(inventoryProducts), [inventoryProducts])
  const fromLine = getTransferSideLine(lineItems, 'from')
  const toLine = getTransferSideLine(lineItems, 'to')

  const syncSides = (side, patch) => {
    setLineItems((prev) => {
      let next = upsertTransferSideLine(prev, side, patch)

      const from = getTransferSideLine(next, 'from')
      const to = getTransferSideLine(next, 'to')

      const fromPure = computePureWeight(from.grossWeight, from.purity)
      const toGross = computeConservedToGross(from.grossWeight, from.purity, to.purity)
      const toPure = toGross > 0 ? fromPure : computePureWeight(to.grossWeight, to.purity)

      next = upsertTransferSideLine(next, 'from', {
        ...from,
        pureWeight: fromPure > 0 ? String(fromPure) : '',
      })
      next = upsertTransferSideLine(next, 'to', {
        ...to,
        grossWeight: toGross > 0 ? String(toGross) : '',
        pureWeight: toPure > 0 ? String(toPure) : '',
      })

      return next
    })
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{
        padding: '0.35rem 0.65rem',
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: 'var(--brand-soft)',
        border: `1px solid ${S.border}`,
        borderBottom: 0,
        color: S.ink,
      }}
      >
        Metal Transfer — conserve pure weight
      </div>
      {loadingInventoryProducts ? (
        <div style={{ padding: '0.75rem', border: `1px solid ${S.border}`, color: '#64748B' }}>Loading products…</div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', border: `1px solid ${S.border}`, padding: '0.75rem', background: '#F8FAFC' }}>
          <SidePanel
            title="From"
            side="from"
            line={fromLine}
            products={products}
            formReadOnly={formReadOnly}
            grossReadOnly={false}
            onChangeSide={syncSides}
          />
          <SidePanel
            title="To"
            side="to"
            line={toLine}
            products={products.filter((p) => String(p._id) !== String(fromLine.inventoryItemId || ''))}
            formReadOnly={formReadOnly}
            grossReadOnly
            onChangeSide={syncSides}
          />
        </div>
      )}
      <div style={{ marginTop: '0.45rem', fontSize: '0.72rem', color: '#64748B' }}>
        To gross is calculated as From pure ÷ To purity so pure metal stays the same.
      </div>
    </div>
  )
}
