#!/usr/bin/env node
/**
 * Rebuild quantityBefore/quantityAfter on active stock movements from a running sum,
 * and sync catalog product.quantity to that sum.
 *
 *   node scripts/repair-stock-movement-balances.js mg --dry-run
 *   node scripts/repair-stock-movement-balances.js mg --apply
 */
require('dotenv').config()
const mongoose = require('mongoose')
const {
  rebuildStockMovementQuantityChain,
  catalogQuantityFromMovements,
  isCatalogInventoryProduct,
} = require('../utils/catalogOnHandQuantity')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')

async function main() {
  const tenant = String(process.argv[2] || '').trim().toLowerCase()
  const apply = process.argv.includes('--apply')
  if (!tenant) {
    console.error('Usage: node scripts/repair-stock-movement-balances.js <tenant> [--dry-run|--apply]')
    process.exit(1)
  }
  const uriKey = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = String(process.env[uriKey] || '').trim()
  if (!uri) {
    console.error(`Missing ${uriKey}`)
    process.exit(1)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })
  const products = await InventoryItem.find({ isDeleted: { $ne: true } })
  let itemsTouched = 0
  let movesUpdated = 0
  let qtyFixed = 0

  for (const product of products) {
    if (!isCatalogInventoryProduct(product.category)) continue
    const active = await StockMovement.find({
      itemId: product._id,
      isDeleted: { $ne: true },
    }).sort({ createdAt: 1, _id: 1 })
    if (!active.length) {
      const nextQty = 0
      if (Math.abs(Number(product.quantity || 0) - nextQty) > 0.0001) {
        console.log(`${product.name}: qty ${product.quantity} → ${nextQty}${apply ? '' : ' (dry-run)'}`)
        if (apply) {
          product.quantity = nextQty
          await product.save()
        }
        qtyFixed += 1
        itemsTouched += 1
      }
      continue
    }

    let run = 0
    let wouldUpdateMoves = 0
    for (const move of active) {
      const before = Math.round(run * 10000) / 10000
      run = Math.round((run + Number(move.change || 0)) * 10000) / 10000
      const after = Math.round(run * 10000) / 10000
      if (
        Math.abs(Number(move.quantityBefore) - before) > 0.00005
        || Math.abs(Number(move.quantityAfter) - after) > 0.00005
      ) {
        wouldUpdateMoves += 1
      }
    }
    const nextQty = catalogQuantityFromMovements(run)
    const qtyDiff = Math.abs(Number(product.quantity || 0) - nextQty) > 0.0001
    if (!wouldUpdateMoves && !qtyDiff) continue

    console.log(
      `${product.name}: movesToFix=${wouldUpdateMoves} qty ${product.quantity} → ${nextQty}${apply ? '' : ' (dry-run)'}`,
    )
    itemsTouched += 1
    if (!apply) continue

    const result = await rebuildStockMovementQuantityChain(StockMovement, product._id)
    movesUpdated += result.updated
    if (qtyDiff) {
      product.quantity = nextQty
      await product.save()
      qtyFixed += 1
    }
  }

  console.log(JSON.stringify({
    tenant,
    mode: apply ? 'apply' : 'dry-run',
    itemsTouched,
    movesUpdated: apply ? movesUpdated : undefined,
    qtyFixed: apply ? qtyFixed : undefined,
  }, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
