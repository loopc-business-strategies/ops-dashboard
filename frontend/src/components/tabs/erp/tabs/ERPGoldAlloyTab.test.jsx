import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const listAlloyMixJobs = vi.fn()
const getStockLedger = vi.fn()
const clearAlloyMixHistory = vi.fn()
const reverseAlloyMix = vi.fn()

vi.mock('../../../../api/erp-accounting', () => ({
  default: {
    listAlloyMixJobs: (...args) => listAlloyMixJobs(...args),
    getStockLedger: (...args) => getStockLedger(...args),
    clearAlloyMixHistory: (...args) => clearAlloyMixHistory(...args),
    reverseAlloyMix: (...args) => reverseAlloyMix(...args),
    postAlloyMix: vi.fn(),
  },
}))

import ERPGoldAlloyTab from './ERPGoldAlloyTab'

const REASON_BASE = 'Gold alloy mix (14K 80 g)'

function ledgerFixture({ isHistory = false } = {}) {
  const deleted = Boolean(isHistory)
  return {
    movements: [
      {
        itemId: 'fin1',
        itemName: '14k alloyed gold',
        change: 80,
        quantityAfter: 80,
        reason: `${REASON_BASE} — receive 14k alloyed gold`,
        actorName: 'Beulah',
        createdAt: '2026-11-16T08:00:02.000Z',
        isDeleted: deleted,
        deletedAt: deleted ? '2026-11-16T09:00:00.000Z' : undefined,
      },
      {
        itemId: 'au1',
        itemName: 'Gold 24K Bar',
        change: -50,
        reason: `${REASON_BASE} — consume gold`,
        createdAt: '2026-11-16T08:00:01.000Z',
        isDeleted: deleted,
        deletedAt: deleted ? '2026-11-16T09:00:00.000Z' : undefined,
      },
      {
        itemId: 'ag1',
        itemName: 'Fine Silver',
        change: -35,
        reason: `${REASON_BASE} — consume silver`,
        createdAt: '2026-11-16T08:00:01.000Z',
        isDeleted: deleted,
        deletedAt: deleted ? '2026-11-16T09:00:00.000Z' : undefined,
      },
    ],
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  getStockLedger.mockResolvedValue(ledgerFixture())
  listAlloyMixJobs.mockResolvedValue({ jobs: [] })
  clearAlloyMixHistory.mockResolvedValue({ success: true, deletedCount: 2 })
  reverseAlloyMix.mockResolvedValue({ success: true })
})

describe('ERPGoldAlloyTab custody + purge', () => {
  test('blocks Edit/Update/Delete when vault parent has open floor descendants', async () => {
    listAlloyMixJobs.mockResolvedValue({
      jobs: [{
        id: 'job-1',
        mixCode: 'AMX-1',
        reasonBase: REASON_BASE,
        status: 'in_vault',
        currentDepartment: 'vault_room',
        canUpdateMix: false,
        hasOpenFloorDescendants: true,
      }],
    })

    render(
      <ERPGoldAlloyTab
        activeTab="gold-alloy"
        token="t"
        tenantKey="mg"
        inventoryProducts={[]}
        mappings={[]}
        loadInventory={vi.fn()}
        showNotification={vi.fn()}
        setError={vi.fn()}
      />,
    )

    const edit = await screen.findByRole('button', { name: 'Edit' })
    const update = screen.getByRole('button', { name: 'Update' })
    const del = screen.getByRole('button', { name: 'Delete' })
    expect(edit.disabled).toBe(true)
    expect(update.disabled).toBe(true)
    expect(del.disabled).toBe(true)
    expect(edit.getAttribute('title')).toMatch(/Split portion still on floor/i)
    expect(update.getAttribute('title')).toMatch(/Allocate child mix/i)
    expect(await screen.findByText('AMX-1')).toBeTruthy()
    expect(screen.getByText('Batch')).toBeTruthy()
    expect(listAlloyMixJobs).toHaveBeenCalledWith('t', expect.objectContaining({ includeClosed: true }))
  })

  test('New mix dialog shows editable Batch No starting at BMG-0001', async () => {
    listAlloyMixJobs.mockResolvedValue({ jobs: [] })
    render(
      <ERPGoldAlloyTab
        activeTab="gold-alloy"
        token="t"
        tenantKey="mg"
        inventoryProducts={[]}
        mappings={[]}
        loadInventory={vi.fn()}
        showNotification={vi.fn()}
        setError={vi.fn()}
      />,
    )

    const newMix = await screen.findByRole('button', { name: '+ New mix' })
    fireEvent.click(newMix)

    const batch = await screen.findByLabelText('Batch number')
    expect(batch.value).toBe('BMG-0001')
    fireEvent.change(batch, { target: { value: '2' } })
    fireEvent.blur(batch)
    expect(batch.value).toBe('BMG-0002')
  })

  test('history purge toast includes deletedCount', async () => {
    const showNotification = vi.fn()
    getStockLedger.mockResolvedValue(ledgerFixture({ isHistory: true }))
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(
      <ERPGoldAlloyTab
        activeTab="gold-alloy"
        token="t"
        tenantKey="mg"
        inventoryProducts={[]}
        mappings={[]}
        loadInventory={vi.fn()}
        showNotification={showNotification}
        setError={vi.fn()}
      />,
    )

    const del = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(del)

    await waitFor(() => {
      expect(clearAlloyMixHistory).toHaveBeenCalledWith('t', expect.objectContaining({
        reason: REASON_BASE,
        karat: 14,
      }))
    })
    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.stringMatching(/Prior mix removed from list \(2 history rows\)/),
      )
    })
  })
})
