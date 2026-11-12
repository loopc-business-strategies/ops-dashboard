import { describe, expect, test } from 'vitest'
import {
  buildInventoryExportPayload,
  buildStockMovementExportPayload,
} from './inventoryExportHelpers'

describe('inventoryExportHelpers', () => {
  test('buildInventoryExportPayload groups category once then products', () => {
    const payload = buildInventoryExportPayload([
      {
        metal: 'Gold',
        metalLabel: 'gold',
        products: [
          { name: 'Gold Bar', pcs: 1, grossQty: 10, purity: '0.999', pureQty: 9.99 },
        ],
        totalPcs: 1,
        totalGross: 10,
        totalPurity: 0.999,
        totalPure: 9.99,
      },
    ])
    expect(payload).toBeTruthy()
    expect(payload.itemCount).toBe(1)
    expect(payload.rows.some((row) => row[0] === 'gold')).toBe(true)
    expect(payload.pdfBody[0][0].colSpan).toBe(5)
  })

  test('buildStockMovementExportPayload nests category and product headers', () => {
    const payload = buildStockMovementExportPayload([
      {
        metal: 'Silver',
        metalLabel: 'silver',
        products: [
          {
            name: 'Fine Silver',
            movements: [
              {
                createdAt: '2026-11-12T10:00:00.000Z',
                change: 5,
                quantityBefore: 10,
                quantityAfter: 15,
                reason: 'Stock IN (purchase)',
                actorName: 'Nan',
              },
              {
                createdAt: '2026-11-11T10:00:00.000Z',
                change: -2,
                quantityBefore: 12,
                quantityAfter: 10,
                reason: 'Stock OUT (sale)',
                actorName: 'Nan',
              },
            ],
          },
        ],
        movementCount: 2,
      },
    ])
    expect(payload).toBeTruthy()
    expect(payload.movementCount).toBe(2)
    expect(payload.sheetName).toBe('Movements')
    expect(payload.rows.some((row) => row[0] === 'silver')).toBe(true)
    expect(payload.rows.some((row) => String(row[0]).includes('Fine Silver'))).toBe(true)
    expect(payload.pdfBody[0][0].colSpan).toBe(6)
    expect(payload.pdfBody[1][0].colSpan).toBe(6)
    expect(payload.pdfBody.some((row) => Array.isArray(row) && String(row[1]).startsWith('+'))).toBe(true)
  })

  test('buildStockMovementExportPayload returns null for empty groups', () => {
    expect(buildStockMovementExportPayload([])).toBeNull()
    expect(buildStockMovementExportPayload(null)).toBeNull()
  })
})
