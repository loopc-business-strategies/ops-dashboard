import React, { useMemo } from 'react'
import { S, decodeInventoryCategoryMeta, decodeFullMeta } from './voucherTabShared'
import { resolveVoucherLinePurityFromProduct } from './voucherLinePurity'
import {
  computeConservedToGross,
  computePureWeight,
  getTransferSideLine,
  upsertTransferSideLine,
} from './metalTransferCalc'

const fieldLabel = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#64748B',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  marginBottom: 4,
}

const compactInput = {
  width: '100%',
  height: 32,
  minHeight: 32,
  padding: '0.2rem 0.45rem',
  fontSize: '0.8125rem',
  border: `1px solid var(--border-input, #9CA3AF)`,
  borderRadius: 4,
  background: S.white,
  color: S.ink,
  boxSizing: 'border-box',
  outline: 'none',
}

const compactReadInput = {
  ...compactInput,
  background: '#F8FAFC',
  color: '#4B5563',
}

const fieldStack = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

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
    <div style={{
      border: `1px solid ${S.border}`,
      background: S.white,
      borderRadius: 4,
      minWidth: 0,
      width: '100%',
    }}
    >
      <div style={{
        padding: '6px 10px',
        fontWeight: 700,
        fontSize: '0.72rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: S.headerBg,
        borderBottom: `1px solid ${S.border}`,
        color: S.ink,
      }}
      >
        {title}
      </div>
      <div style={{ padding: 10, display: 'grid', gap: 8 }}>
        <div style={fieldStack}>
          <label style={fieldLabel}>Product</label>
          <select
            style={compactInput}
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
            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#64748B' }}>
              On hand: {Number(selected.quantity || 0).toFixed(3)} g
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={fieldStack}>
            <label style={fieldLabel}>Purity</label>
            <input style={compactReadInput} readOnly value={line.purity || ''} />
          </div>
          <div style={fieldStack}>
            <label style={fieldLabel}>Qty (PCS)</label>
            <input
              style={compactInput}
              type="number"
              step="1"
              disabled={formReadOnly}
              value={line.pcs || ''}
              onChange={(e) => onChangeSide(side, { pcs: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={fieldStack}>
            <label style={fieldLabel}>Gross Weight (g)</label>
            <input
              style={grossReadOnly ? compactReadInput : compactInput}
              type="number"
              step="0.001"
              disabled={formReadOnly || grossReadOnly}
              readOnly={grossReadOnly}
              value={line.grossWeight || ''}
              onChange={(e) => onChangeSide(side, { grossWeight: e.target.value })}
            />
          </div>
          <div style={fieldStack}>
            <label style={fieldLabel}>Pure Weight (g)</label>
            <input
              style={compactReadInput}
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
    <div style={{ marginTop: 0 }}>
      <div style={{
        padding: '6px 10px',
        fontWeight: 700,
        fontSize: '0.7rem',
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
        <div style={{ padding: 10, border: `1px solid ${S.border}`, color: '#64748B', fontSize: '0.8rem' }}>Loading products…</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 8,
            border: `1px solid ${S.border}`,
            padding: 10,
            background: '#F8FAFC',
          }}
        >
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
      <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#64748B' }}>
        To gross is calculated as From pure ÷ To purity so pure metal stays the same.
      </div>
    </div>
  )
}
