import { describe, expect, test } from 'vitest'
import {
  applyAlloyRecipeToLines,
  computeAlloyComponentGross,
  computeAlloyPure,
  createEmptyAlloyLines,
  addAlloyLineByKey,
  buildAlloyInputStockOptions,
  buildAlloyInputStockOptionsForLine,
  matchesAlloyLineMetal,
  createBlankAlloyMixLines,
  findFinishedAlloyProductHint,
  listAvailableAlloyLineTemplates,
  normalizeAlloyPurity,
  pickPreferredFineGoldStock,
  removeAlloyExtraLine,
  summarizeAlloyLines,
  validateAlloyMixPost,
  visibleAlloyLines,
  buildPostedAlloyMixEntryFromResult,
  buildPostedAlloyMixListFromMovements,
  groupPostedAlloyMixes,
  buildAlloyLinesFromPostedMix,
  alloyPurityToPercent,
  alloyPercentToPurityFraction,
  alloyMixStatusFromReason,
  buildAlloyMixReasonBase,
  computeCalculatedGrossFromGoldWeight,
  computeAlloyMetalLoss,
  computeAlloyMixShare,
  patchInventoryCategoryPurity,
  buildFinishedUpdateFormFromPosted,
  buildAlloyLinesForFinishedGrossUpdate,
} from './goldAlloyCalculator'

describe('goldAlloyCalculator', () => {
  test('22k ratios on 100 g match the reference sheet', () => {
    expect(computeAlloyComponentGross(100, 91.6)).toBe(91.6)
    expect(computeAlloyComponentGross(100, 8.4)).toBe(8.4)
    let lines = createBlankAlloyMixLines()
    lines = addAlloyLineByKey(lines, 'gold')
    lines = addAlloyLineByKey(lines, 'silver')
    lines = applyAlloyRecipeToLines(lines, {
      targetGross: 100,
      goldRatio: 91.6,
      alloyRatio: 8.4,
    })
    expect(lines.find((l) => l.role === 'gold')).toMatchObject({ gross: 91.6, pure: 91.6 })
    expect(lines.find((l) => l.role === 'alloy')).toMatchObject({ gross: 8.4, pure: 8.4 })
    const summary = summarizeAlloyLines(lines, 100)
    expect(summary.balanced).toBe(true)
    expect(summary.percent).toBe(100)
    expect(summary.checkLabel).toBe('100%')
  })

  test('18k splits alloy share across silver and copper when both rows exist', () => {
    let lines = createBlankAlloyMixLines()
    lines = addAlloyLineByKey(lines, 'gold')
    lines = addAlloyLineByKey(lines, 'silver')
    lines = addAlloyLineByKey(lines, 'copper')
    lines = applyAlloyRecipeToLines(lines, {
      targetGross: 10,
      goldRatio: 75,
      alloyRatio: 25,
    })
    expect(lines.find((l) => l.key === 'gold')).toMatchObject({ gross: 7.5 })
    expect(lines.find((l) => l.key === 'silver')).toMatchObject({ gross: 1.25 })
    expect(lines.find((l) => l.key === 'copper')).toMatchObject({ gross: 1.25 })
    expect(summarizeAlloyLines(lines, 10)).toMatchObject({ balanced: true, checkLabel: '100%' })
  })

  test('scales with target gross weight', () => {
    expect(computeAlloyComponentGross(250, 91.6)).toBe(229)
    expect(computeAlloyComponentGross(250, 8.4)).toBe(21)
  })

  test('calculated gross from gold weight matches allowing-gold sheet', () => {
    // 18K: gold ratio 75% → 200 / 0.75 = 266.6667
    expect(computeCalculatedGrossFromGoldWeight(200, 75)).toBe('266.6667')
    let lines = createBlankAlloyMixLines()
    lines = addAlloyLineByKey(lines, 'gold')
    lines = addAlloyLineByKey(lines, 'silver')
    lines = addAlloyLineByKey(lines, 'copper')
    lines = applyAlloyRecipeToLines(lines, {
      targetGross: computeCalculatedGrossFromGoldWeight(200, 75),
      goldRatio: 75,
      alloyRatio: 25,
    })
    expect(lines.find((l) => l.key === 'gold')).toMatchObject({ gross: 200 })
    expect(summarizeAlloyLines(lines, 266.6667).balanced).toBe(true)
  })

  test('normalizes purity and computes pure', () => {
    expect(normalizeAlloyPurity(1)).toBe(1)
    expect(normalizeAlloyPurity(0.916)).toBe(0.916)
    expect(normalizeAlloyPurity(91.6)).toBeCloseTo(0.916)
    expect(normalizeAlloyPurity(916)).toBeCloseTo(0.916)
    expect(computeAlloyPure(100, 0.916)).toBe(91.6)
  })

  test('hides unused extra metals until shown or filled', () => {
    const lines = createEmptyAlloyLines()
    expect(visibleAlloyLines(lines, { showExtras: false }).map((l) => l.key)).toEqual(['gold', 'silver'])
    expect(visibleAlloyLines(lines, { showExtras: true }).map((l) => l.key)).toEqual([
      'gold', 'silver', 'copper', 'cadmium', 'platinum',
    ])
  })

  test('prefers fine gold stock and hints finished 22k alloy product', () => {
    const options = [
      { id: 'a', name: 'Gold 22K Bar', mainStock: 'gold', purity: '0.916', kind: 'product' },
      { id: 'b', name: 'Fine Gold Bar', mainStock: 'gold', purity: '1', kind: 'product' },
      { id: 'c', name: '22k Alloyed Gold', mainStock: 'alloy', purity: '0.916', kind: 'product' },
    ]
    expect(pickPreferredFineGoldStock(options)?.id).toBe('b')
    expect(findFinishedAlloyProductHint(22, options).id).toBe('c')
    expect(findFinishedAlloyProductHint(22, options).message).toMatch(/22k Alloyed Gold/)
  })

  test('blank mix starts empty; user picks which row to add', () => {
    const blank = createBlankAlloyMixLines()
    expect(blank).toEqual([])
    expect(listAvailableAlloyLineTemplates(blank).map((r) => r.key)).toEqual([
      'gold', 'silver', 'copper', 'cadmium', 'platinum',
    ])
    const withSilver = addAlloyLineByKey(blank, 'silver')
    expect(withSilver.map((l) => l.key)).toEqual(['silver'])
    expect(listAvailableAlloyLineTemplates(withSilver).map((r) => r.key)).toEqual([
      'gold', 'copper', 'cadmium', 'platinum',
    ])
    const withGold = addAlloyLineByKey(withSilver, 'gold')
    expect(withGold.map((l) => l.key)).toEqual(['silver', 'gold'])
    expect(removeAlloyExtraLine(withGold, 'gold').map((l) => l.key)).toEqual(['silver'])
  })

  test('Add stock menu only lists metals with matching created products', () => {
    const options = [
      { id: 'au', name: 'Gold 24K Bar', mainStock: 'gold', kind: 'product', quantity: 500 },
      { id: 'ag', name: 'Fine Silver', mainStock: 'silver', kind: 'product', quantity: 500 },
      { id: 'cu', name: 'Fine Copper', mainStock: 'copper', kind: 'product', quantity: 500 },
      { id: 'alloy', name: '18K Alloyed Gold', mainStock: 'alloy', kind: 'product', quantity: 500 },
      { id: 'st', name: 'Gold', mainStock: 'gold', kind: 'stock-type', quantity: 0 },
    ]
    expect(listAvailableAlloyLineTemplates([], { stockOptions: options }).map((r) => r.key)).toEqual([
      'gold', 'silver', 'copper',
    ])
    expect(listAvailableAlloyLineTemplates(
      [{ key: 'gold' }],
      { stockOptions: options },
    ).map((r) => r.key)).toEqual(['silver', 'copper'])
    expect(listAvailableAlloyLineTemplates([], { stockOptions: [] }).map((r) => r.key)).toEqual([])
  })

  test('input select lists catalog products only and can exclude finished id', () => {
    const options = [
      { id: 'p1', name: 'Gold 24K', kind: 'product', quantity: 12 },
      { id: 't1', name: 'Gold Main Stock', kind: 'stock-type', quantity: 0 },
      { id: 'f1', name: '22K Alloyed Gold', kind: 'product', quantity: 0 },
    ]
    expect(buildAlloyInputStockOptions(options).map((r) => r.id)).toEqual(['p1'])
    expect(buildAlloyInputStockOptions(options, { excludeIds: ['p1'] }).map((r) => r.id)).toEqual([])
  })

  test('stock product dropdown matches line metal only', () => {
    const options = [
      { id: 'au22', name: 'Gold 22K Bar', mainStock: 'gold', kind: 'product', quantity: 10 },
      { id: 'au24', name: 'Gold 24K Bar', mainStock: 'gold', kind: 'product', quantity: 40 },
      { id: 'ag', name: 'Fine Silver', mainStock: 'silver', kind: 'product', quantity: 14 },
      { id: 'cu', name: 'Fine Copper', mainStock: 'copper', kind: 'product', quantity: 16 },
      { id: 'alloy', name: '18K Alloyed Gold', mainStock: 'alloy', kind: 'product', quantity: 5 },
    ]
    expect(matchesAlloyLineMetal(options[0], 'gold')).toBe(true)
    expect(matchesAlloyLineMetal(options[2], 'gold')).toBe(false)
    expect(buildAlloyInputStockOptionsForLine(options, 'gold').map((r) => r.id)).toEqual(['au22', 'au24'])
    expect(buildAlloyInputStockOptionsForLine(options, 'silver').map((r) => r.id)).toEqual(['ag'])
    expect(buildAlloyInputStockOptionsForLine(options, 'copper').map((r) => r.id)).toEqual(['cu'])
  })

  test('builds posted mix list from stock movements and post result', () => {
    const fromResult = buildPostedAlloyMixEntryFromResult({
      karat: 18,
      targetGross: 10,
      reason: 'Gold alloy mix (18K 10 g)',
      finishedProduct: { name: '18K Alloyed Gold', quantity: 20 },
      consumed: [
        { name: 'Gold 24K Bar', gross: 7.5 },
        { name: 'Fine Silver', gross: 1.25 },
        { name: 'Fine Copper', gross: 1.25 },
      ],
    }, { at: '2026-10-30T10:00:00.000Z' })
    expect(fromResult).toMatchObject({
      karat: 18,
      targetGross: 10,
      finishedName: '18K Alloyed Gold',
      finishedQtyAfter: 20,
    })
    expect(fromResult.consumed).toHaveLength(3)

    const fromLedger = buildPostedAlloyMixListFromMovements([
      {
        itemId: 'fin1',
        itemName: '18K Alloyed Gold',
        change: 10,
        quantityAfter: 20,
        reason: 'Local 18K mix example — gold + silver + copper — receive 18K Alloyed Gold',
        actorName: 'Nan',
        createdAt: '2026-10-30T10:00:02.000Z',
      },
      {
        itemId: 'cu1',
        itemName: 'Fine Copper',
        change: -1.25,
        reason: 'Local 18K mix example — gold + silver + copper — consume copper',
        createdAt: '2026-10-30T10:00:01.000Z',
      },
      {
        itemId: 'ag1',
        itemName: 'Fine Silver',
        change: -1.25,
        reason: 'Local 18K mix example — gold + silver + copper — consume silver',
        createdAt: '2026-10-30T10:00:01.000Z',
      },
      {
        itemId: 'au1',
        itemName: 'Gold 24K Bar',
        change: -7.5,
        reason: 'Local 18K mix example — gold + silver + copper — consume gold',
        createdAt: '2026-10-30T10:00:01.000Z',
      },
      {
        itemName: 'Other',
        change: 1,
        reason: 'Purchase voucher',
        createdAt: '2026-10-30T09:00:00.000Z',
      },
    ])
    expect(fromLedger).toHaveLength(1)
    expect(fromLedger[0]).toMatchObject({
      karat: 18,
      targetGross: 10,
      finishedName: '18K Alloyed Gold',
      actorName: 'Nan',
    })
    expect(fromLedger[0].consumed.map((r) => r.name).sort()).toEqual([
      'Fine Copper', 'Fine Silver', 'Gold 24K Bar',
    ])
    expect(fromLedger[0].finishedProductId).toBeTruthy()
    const editLines = buildAlloyLinesFromPostedMix(fromLedger[0])
    expect(editLines.map((l) => l.key).sort()).toEqual(['copper', 'gold', 'silver'])
    expect(editLines.find((l) => l.key === 'gold').gross).toBe(7.5)
  })

  test('validateAlloyMixPost requires balance, stocks, and finished product', () => {
    let lines = createBlankAlloyMixLines()
    lines = addAlloyLineByKey(lines, 'gold')
    lines = addAlloyLineByKey(lines, 'silver')
    lines = applyAlloyRecipeToLines(lines, {
      targetGross: 100,
      goldRatio: 91.6,
      alloyRatio: 8.4,
    }).map((line) => {
      if (line.role === 'gold') return { ...line, stockId: 'g1' }
      if (line.role === 'alloy') return { ...line, stockId: 's1' }
      return line
    })
    const stockOptions = [
      { id: 'g1', name: 'Fine Gold', quantity: 200 },
      { id: 's1', name: 'Silver', quantity: 50 },
      { id: 'f1', name: '22K Alloyed Gold', quantity: 0 },
    ]
    expect(validateAlloyMixPost({
      karat: 22,
      targetGross: 100,
      lines,
      finishedProductId: 'f1',
      stockOptions,
    }).ok).toBe(true)
    expect(validateAlloyMixPost({
      karat: 22,
      targetGross: 100,
      lines,
      finishedProductId: 'f1',
      stockOptions: [
        { id: 'g1', name: 'Fine Gold', quantity: 10 },
        { id: 's1', name: 'Silver', quantity: 50 },
        { id: 'f1', name: '22K Alloyed Gold', quantity: 0 },
      ],
    }).ok).toBe(false)
  })

  test('mix reason encodes posted vs updated status', () => {
    expect(buildAlloyMixReasonBase({ karat: 18, targetGross: 12 })).toBe('Gold alloy mix (18K 12 g)')
    expect(buildAlloyMixReasonBase({ karat: 18, targetGross: 12, status: 'updated' }))
      .toBe('Gold alloy mix (18K 12 g · updated)')
    expect(alloyMixStatusFromReason('Gold alloy mix (18K 12 g)')).toBe('posted')
    expect(alloyMixStatusFromReason('Gold alloy mix (18K 12 g · updated)')).toBe('updated')

    const updatedList = buildPostedAlloyMixListFromMovements([
      {
        itemId: 'fin1',
        itemName: '18K Alloyed Gold',
        change: 12,
        quantityAfter: 12,
        reason: 'Gold alloy mix (18K 12 g · updated) — receive 18K Alloyed Gold',
        actorName: 'Nan',
        createdAt: '2026-10-30T12:00:02.000Z',
      },
      {
        itemId: 'au1',
        itemName: 'Gold 24K Bar',
        change: -9,
        reason: 'Gold alloy mix (18K 12 g · updated) — consume gold',
        createdAt: '2026-10-30T12:00:01.000Z',
      },
      {
        itemId: 'fin1',
        itemName: '18K Alloyed Gold',
        change: 10,
        quantityAfter: 10,
        reason: 'Gold alloy mix (18K 10 g) — receive 18K Alloyed Gold',
        actorName: 'Nan',
        createdAt: '2026-10-30T11:00:02.000Z',
        isDeleted: true,
        deletedAt: '2026-10-30T12:00:00.000Z',
      },
      {
        itemId: 'au1',
        itemName: 'Gold 24K Bar',
        change: -7.5,
        reason: 'Gold alloy mix (18K 10 g) — consume gold',
        createdAt: '2026-10-30T11:00:01.000Z',
        isDeleted: true,
        deletedAt: '2026-10-30T12:00:00.000Z',
      },
    ])
    expect(updatedList).toHaveLength(2)
    expect(updatedList[0]).toMatchObject({
      status: 'updated',
      finishedName: '18K Alloyed Gold',
      targetGross: 12,
      isHistory: false,
    })
    expect(updatedList[1]).toMatchObject({
      status: 'posted',
      targetGross: 10,
      isHistory: true,
    })
    expect(updatedList[1].consumed.map((r) => r.name).sort()).toEqual(['Gold 24K Bar'])

    // Every prior history row for the same finished product stays visible.
    const withExtraPrior = buildPostedAlloyMixListFromMovements([
      ...[
        {
          itemId: 'fin1',
          itemName: '18K Alloyed Gold',
          change: 12,
          reason: 'Gold alloy mix (18K 12 g · updated) — receive 18K Alloyed Gold',
          createdAt: '2026-10-30T12:00:02.000Z',
        },
      ],
      {
        itemId: 'fin1',
        itemName: '18K Alloyed Gold',
        change: 10,
        reason: 'Gold alloy mix (18K 10 g) — receive 18K Alloyed Gold',
        createdAt: '2026-10-30T11:00:02.000Z',
        isDeleted: true,
        deletedAt: '2026-10-30T12:00:00.000Z',
      },
      {
        itemId: 'fin1',
        itemName: '18K Alloyed Gold',
        change: 8,
        reason: 'Gold alloy mix (18K 8 g) — receive 18K Alloyed Gold',
        createdAt: '2026-10-30T10:00:02.000Z',
        isDeleted: true,
        deletedAt: '2026-10-30T10:30:00.000Z',
      },
    ])
    expect(withExtraPrior.filter((r) => r.isHistory).map((r) => r.targetGross)).toEqual([10, 8])
    expect(withExtraPrior).toHaveLength(3)

    const grouped = groupPostedAlloyMixes(withExtraPrior)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].finishedName).toBe('18K Alloyed Gold')
    expect(grouped[0].rows.map((r) => r.targetGross)).toEqual([12, 10, 8])
    expect(grouped[0].rows[0].isGroupHead).toBe(true)
    expect(grouped[0].rows[1].linkedPrior).toBe(true)
    expect(grouped[0].hasActive).toBe(true)
  })

  test('finished update form uses single product with purity percent', () => {
    expect(alloyPurityToPercent(0.75)).toBe('75')
    expect(alloyPercentToPurityFraction(75)).toBe('0.75')
    expect(patchInventoryCategoryPurity(
      'mainStock=alloy;recordType=product;productPurity=0.75',
      0.76,
    )).toMatch(/productPurity=0\.76/)

    const posted = {
      karat: 18,
      targetGross: 10,
      finishedName: '18K Alloyed Gold',
      finishedProductId: 'fin18',
      consumed: [
        { itemId: 'au', name: 'Gold 24K Bar', gross: 7.5, key: 'gold', role: 'gold' },
        { itemId: 'ag', name: 'Fine Silver', gross: 2.5, key: 'silver', role: 'alloy' },
      ],
    }
    const form = buildFinishedUpdateFormFromPosted(posted, [
      { id: 'fin18', name: '18K Alloyed Gold', purity: '0.75' },
    ])
    expect(form).toMatchObject({
      finishedName: '18K Alloyed Gold',
      gross: '10',
      purityPercent: '75',
    })

    const scaled = buildAlloyLinesForFinishedGrossUpdate(posted, { targetGross: 20 })
    expect(scaled.find((l) => l.key === 'gold').gross).toBe(15)
    expect(scaled.find((l) => l.key === 'silver').gross).toBe(5)
  })

  test('update mix sheet example: 266.6667→266 keeps shares and metal loss', () => {
    const posted = {
      karat: 18,
      targetGross: 266.6667,
      finishedName: '18K Alloyed Gold',
      finishedProductId: 'fin18',
      consumed: [
        { itemId: 'au', name: 'gold bar', gross: 200, key: 'gold', role: 'gold' },
        { itemId: 'ag', name: 'silver pure', gross: 36.6, key: 'silver', role: 'alloy' },
        { itemId: 'cu', name: 'cop pure', gross: 30, key: 'copper', role: 'extra' },
      ],
    }
    const scaled = buildAlloyLinesForFinishedGrossUpdate(posted, { targetGross: 266 })
    const gold = scaled.find((l) => l.key === 'gold')
    const silver = scaled.find((l) => l.key === 'silver')
    const copper = scaled.find((l) => l.key === 'copper')
    const metalSum = Number(gold.gross) + Number(silver.gross) + Number(copper.gross)

    expect(gold.gross).toBe(199.5)
    expect(computeAlloyMetalLoss(gold.gross, 200)).toBe(-0.5)
    expect(computeAlloyMixShare(gold.gross, 266)).toBe('0.75')

    expect(silver.gross).toBe(36.508)
    expect(computeAlloyMetalLoss(silver.gross, 36.6)).toBe(-0.092)

    // Last metal absorbs rounding so metals always equal finished target.
    expect(metalSum).toBe(266)
    expect(copper.gross).toBe(29.992)
    expect(computeAlloyMetalLoss(copper.gross, 30)).toBe(-0.008)
  })

  test('gold input 7.5 @ 18K → mix target 10; update 10→9.5 stays balanced', () => {
    expect(computeCalculatedGrossFromGoldWeight(7.5, 75)).toBe('10')
    const posted = {
      karat: 18,
      targetGross: 10,
      finishedName: '18K Alloyed Gold',
      finishedProductId: 'fin18',
      consumed: [
        { itemId: 'au', name: 'gold', gross: 7.5, key: 'gold', role: 'gold' },
        { itemId: 'ag', name: 'silver', gross: 1.25, key: 'silver', role: 'alloy' },
        { itemId: 'cu', name: 'copper', gross: 1.25, key: 'copper', role: 'extra' },
      ],
    }
    const scaled = buildAlloyLinesForFinishedGrossUpdate(posted, { targetGross: 9.5 })
    const sum = scaled.reduce((s, l) => s + Number(l.gross || 0), 0)
    expect(sum).toBe(9.5)
    expect(computeAlloyMetalLoss(9.5, 10)).toBe(-0.5)
    expect(computeAlloyMixShare(scaled.find((l) => l.key === 'gold').gross, 9.5)).toBe('0.75')
  })
})
