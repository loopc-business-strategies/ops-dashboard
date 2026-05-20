#!/usr/bin/env node
/**
 * One-off repair for misposted metal **purchase** vouchers (MG/CG/LoopC):
 * 1) Point main purchase + VAT-input ledger **credit** lines to the voucher **party** payable
 *    (e.g. 2305) when they were posted to vendor.ledgerAccountId / generic AP instead.
 * 2) Optionally sync the vendor master **ledgerAccountId** to that party account.
 * 3) Move **stock** from a mistaken non-product row (e.g. "Gold Main Stock" / sku GOLD template)
 *    to the scored **product** line (recordType=product), and fix StockMovement.itemId/itemName.
 *
 * Default: **dry-run** (prints planned changes, no DB writes).
 * Apply: pass destructive guard flags (see below).
 *
 * Usage (preview):
 *   node scripts/repair-misposted-purchase-voucher.js --tenant=mg --voc-no=Pur/2026/0001
 *
 * Usage (execute):
 *   node scripts/repair-misposted-purchase-voucher.js --tenant=mg --apply --reason="Repair misposted purchase AP+inventory" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN" --voc-no=Pur/2026/0001
 *
 * Env:
 *   REPAIR_SYNC_VENDOR_LEDGER=true|false  (default true) — set vendor.ledgerAccountId to party payable when matched.
 */

require('dotenv').config()
const path = require('path')
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const categoryPurityFromString = (category) => {
  const m = String(category || '').match(/(?:^|;)purity=([\d.]+)/i)
  return m ? Number(m[1]) : 0
}

const metalCategoryClauseForStockCode = (stockCode) => {
  const c = String(stockCode || '').trim().toUpperCase()
  if (!c) return null
  if (c === 'GOLD' || c === 'XAU') {
    return { $or: [{ category: /mainStock=gold/i }, { category: /metalType=gold/i }, { category: /metalType=xau/i }] }
  }
  if (c === 'SILVER' || c === 'XAG') {
    return { $or: [{ category: /mainStock=silver/i }, { category: /metalType=silver/i }, { category: /metalType=xag/i }] }
  }
  if (c === 'PLATINUM' || c === 'XPT') {
    return { $or: [{ category: /mainStock=platinum/i }, { category: /metalType=platinum/i }, { category: /metalType=xpt/i }] }
  }
  if (c === 'PALLADIUM' || c === 'XPD') {
    return { $or: [{ category: /mainStock=palladium/i }, { category: /metalType=palladium/i }, { category: /metalType=xpd/i }] }
  }
  return null
}

const scoreInventoryLineMatch = (item, line) => {
  const stockCode = String(line?.stockCode || '').trim().toLowerCase()
  const productType = String(line?.productType || '').trim().toLowerCase()
  const cat = String(item.category || '')
  const isProduct = /recordType=product/i.test(cat)
  let score = 0
  if (isProduct) score += 200
  if (productType && String(item.name || '').trim().toLowerCase() === productType) score += 90
  if (stockCode && String(item.sku || '').trim().toLowerCase() === stockCode) score += 80
  const linePurity = Number(line.purity || 0)
  const pr = linePurity > 1.2 ? linePurity / 1000 : linePurity
  const itemPurRaw = categoryPurityFromString(cat)
  const ir = itemPurRaw > 1.2 ? itemPurRaw / 1000 : itemPurRaw
  if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 1e-6) score += 70
  else if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 0.02) score += 40
  const lineGross = Number(line.grossWeight || 0)
  const mGw = cat.match(/(?:^|;)grossWeight=([\d.]+)/i) || cat.match(/(?:^|;)weight=([\d.]+)/i)
  const itemGross = mGw ? Number(mGw[1]) : Number(item.weight || 0)
  if (lineGross > 0 && itemGross > 0 && Math.abs(lineGross - itemGross) < 0.001) score += 25
  return score
}

async function resolvePartyAccount(ChartOfAccount, tx) {
  const meta = tx.voucherMeta || {}
  const id = String(meta.partyAccountId || '').trim()
  if (mongoose.Types.ObjectId.isValid(id)) {
    const acc = await ChartOfAccount.findById(id).lean()
    if (acc) return acc
  }
  const code = String(meta.partyCode || '').trim()
  if (code) {
    return ChartOfAccount.findOne({ accountCode: code, isActive: true }).lean()
      || ChartOfAccount.findOne({ accountCode: code }).sort({ isActive: -1, createdAt: 1 }).lean()
  }
  return null
}

async function resolveTargetProductForTx(InventoryItem, tx) {
  const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  let bestItem = null
  let bestScore = -1

  for (const line of lines) {
    const stockCode = String(line?.stockCode || '').trim()
    const productType = String(line?.productType || '').trim()
    if (!stockCode && !productType) continue

    const orConditions = [
      ...(stockCode ? [{ sku: stockCode }] : []),
      ...(productType ? [{ name: new RegExp(`^${escapeRegex(productType)}$`, 'i') }] : []),
    ]
    if (!orConditions.length) continue

    let candidates = await InventoryItem.find({
      isDeleted: { $ne: true },
      category: /recordType=product/i,
      $or: orConditions,
    }).limit(40).lean()

    if (!candidates.length) {
      const metalClause = metalCategoryClauseForStockCode(stockCode)
      if (metalClause) {
        candidates = await InventoryItem.find({
          isDeleted: { $ne: true },
          category: /recordType=product/i,
          ...metalClause,
        }).limit(40).lean()
      }
    }

    if (!candidates.length) {
      candidates = await InventoryItem.find({ isDeleted: { $ne: true }, $or: orConditions }).limit(40).lean()
    }

    if (!candidates.length) continue

    const sorted = [...candidates].sort((a, b) => scoreInventoryLineMatch(b, line) - scoreInventoryLineMatch(a, line))
    const top = sorted[0]
    const sc = scoreInventoryLineMatch(top, line)
    if (sc > bestScore) {
      bestScore = sc
      bestItem = top
    }
  }

  return bestItem
}

function isProductItem(doc) {
  return doc && /recordType=product/i.test(String(doc.category || ''))
}

async function main() {
  const tenant = normalizeTenant(readArgValue('--tenant') || readArgValue('-t'))
  if (!tenant) {
    console.error('Missing --tenant=mg|cg|loopc')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  if (apply) {
    require(path.join(__dirname, 'destructive', '_destructive-guard'))({
      scriptName: path.basename(__filename),
    })
  } else {
    console.log('--- DRY-RUN (no writes). Re-run with --apply and destructive guard args to commit. ---\n')
  }

  const vocNoArg = String(readArgValue('--voc-no') || process.env.REPAIR_VOC_NO || 'Pur/2026/0001').trim()
  const vocEsc = escapeRegex(vocNoArg)
  const syncVendor = String(process.env.REPAIR_SYNC_VENDOR_LEDGER || 'true').toLowerCase() !== 'false'

  const uri = getTenantUri(tenant)
  if (!uri) {
    console.error(`Missing Mongo URI for tenant ${tenant} (set env from config/tenants.js)`)
    process.exit(1)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })

  const Transaction = require('../models/Transaction')
  const Ledger = require('../models/Ledger')
  const InventoryItem = require('../models/InventoryItem')
  const StockMovement = require('../models/StockMovement')
  const Vendor = require('../models/Vendor')
  const ChartOfAccount = require('../models/ChartOfAccount')
  const User = require('../models/User')

  const actor =
    (await User.findOne({ role: 'super_admin', isActive: true }).select('_id name').lean())
    || (await User.findOne({ role: 'management', isActive: true }).select('_id name').lean())
    || (await User.findOne({ isActive: true }).select('_id name').lean())

  const vocRegex = new RegExp(vocEsc, 'i')
  const txs = await Transaction.find({
    type: 'purchase',
    status: 'posted',
    isDeleted: { $ne: true },
    'voucherMeta.vocNo': vocRegex,
  })
    .select('_id amount voucherMeta vendorId creditAccountId journalEntryId')
    .lean()

  if (!txs.length) {
    console.log(`No posted purchase transactions matched voc-no ~ /${vocEsc}/i`)
    await mongoose.disconnect()
    return
  }

  console.log(`Tenant: ${tenant} | Matched ${txs.length} transaction(s) | voc-no: ${vocNoArg} | apply=${apply}\n`)

  for (const txLean of txs) {
    const tx = await Transaction.findById(txLean._id)
    if (!tx) continue

    const party = await resolvePartyAccount(ChartOfAccount, tx)
    if (!party) {
      console.log(`[skip] ${tx._id} — no voucher partyAccountId / partyCode; cannot infer target payable.`)
      continue
    }

    const targetCreditId = String(party._id)
    console.log(`--- Transaction ${tx._id} vocNo=${tx.voucherMeta?.vocNo || ''} party=${party.accountCode} ${party.accountName}`)

    const ledgers = await Ledger.find({
      referenceId: tx._id,
      isDeleted: { $ne: true },
      referenceType: { $in: ['purchase', 'vat_input'] },
    }).select('_id referenceType debitAccountId creditAccountId amount')

    const ledgerUpdates = []
    for (const le of ledgers) {
      if (String(le.creditAccountId) === targetCreditId) continue
      ledgerUpdates.push({
        _id: le._id,
        referenceType: le.referenceType,
        from: String(le.creditAccountId),
        to: targetCreditId,
        amount: le.amount,
      })
    }

    if (ledgerUpdates.length) {
      console.log(`  Ledger credit fixes (${ledgerUpdates.length}):`)
      ledgerUpdates.forEach((u) => {
        console.log(`    ${u.referenceType} ${u._id}: credit ${u.from} -> ${u.to} amt=${u.amount}`)
      })
    } else {
      console.log('  Ledger: purchase/vat_input credits already match party payable.')
    }

    const txCreditWrong = String(tx.creditAccountId || '') !== targetCreditId
    if (txCreditWrong) {
      console.log(`  Transaction.creditAccountId: ${tx.creditAccountId} -> ${targetCreditId}`)
    }

    const targetProduct = await resolveTargetProductForTx(InventoryItem, tx)
    const txVoc = String(tx.voucherMeta?.vocNo || vocNoArg).trim()
    const movementReasonRx = txVoc
      ? new RegExp(`Voucher\\s*purchase\\s*\\([^)]*\\)\\s*#?\\s*${escapeRegex(txVoc)}`, 'i')
      : new RegExp(`Voucher\\s*purchase`, 'i')
    const movements = await StockMovement.find({
      reason: movementReasonRx,
      isDeleted: { $ne: true },
    }).sort({ createdAt: 1 })

    const stockPlans = []
    for (const mv of movements) {
      const linked = await InventoryItem.findById(mv.itemId).lean()
      if (!linked) continue
      if (!targetProduct || String(linked._id) === String(targetProduct._id)) {
        if (targetProduct && String(linked._id) === String(targetProduct._id)) {
          console.log(`  StockMovement ${mv._id}: already on target product "${linked.name}"`)
        }
        continue
      }
      const delta = Number(mv.change || 0)
      if (!Number.isFinite(delta) || delta === 0) continue
      if (isProductItem(linked)) {
        console.log(`  StockMovement ${mv._id}: on different product "${linked.name}" — manual review recommended; skipping move.`)
        continue
      }
      stockPlans.push({
        movementId: mv._id,
        wrongItemId: linked._id,
        wrongName: linked.name,
        targetProductId: targetProduct._id,
        targetName: targetProduct.name,
        delta,
      })
    }

    if (stockPlans.length) {
      console.log(`  Stock corrections (${stockPlans.length}):`)
      stockPlans.forEach((p) => {
        console.log(`    Move Δ=${p.delta} g from "${p.wrongName}" -> "${p.targetName}" (movement ${p.movementId})`)
      })
    } else if (targetProduct) {
      console.log('  Stock: no template/stock-type movements to repoint for this voc-no filter.')
    } else {
      console.log('  Stock: could not resolve a target product from voucher lines.')
    }

    let vendorPlan = null
    if (syncVendor && tx.vendorId) {
      const vendor = await Vendor.findById(tx.vendorId).select('_id name ledgerAccountId').lean()
      if (vendor && String(vendor.ledgerAccountId || '') !== targetCreditId) {
        vendorPlan = { vendorId: vendor._id, name: vendor.name, from: String(vendor.ledgerAccountId || ''), to: targetCreditId }
        console.log(`  Vendor "${vendor.name}": ledgerAccountId ${vendorPlan.from || '(none)'} -> ${targetCreditId}`)
      }
    }

    if (!apply) continue

    for (const u of ledgerUpdates) {
      await Ledger.updateOne(
        { _id: u._id },
        {
          $set: {
            creditAccountId: u.to,
            updatedBy: actor?._id || undefined,
          },
        },
      )
    }

    if (txCreditWrong) {
      tx.creditAccountId = party._id
      tx.updatedBy = actor?._id || tx.updatedBy
      await tx.save()
    }

    for (const p of stockPlans) {
      const wrong = await InventoryItem.findById(p.wrongItemId)
      const right = await InventoryItem.findById(p.targetProductId)
      if (!wrong || !right) continue

      const d = Math.abs(Number(p.delta || 0))
      const wq = Math.max(0, Number(wrong.quantity || 0))
      const rq = Number(right.quantity || 0)
      const takeFromWrong = Math.min(wq, d)

      if (takeFromWrong > 0) {
        wrong.quantity = wq - takeFromWrong
        wrong.updatedBy = actor?._id || wrong.updatedBy
        await wrong.save()
        right.quantity = rq + takeFromWrong
        right.updatedBy = actor?._id || right.updatedBy
        await right.save()
      } else if (rq < d - 1e-6) {
        right.quantity = rq + d
        right.updatedBy = actor?._id || right.updatedBy
        await right.save()
      }

      await StockMovement.updateOne(
        { _id: p.movementId },
        {
          $set: {
            itemId: right._id,
            itemName: right.name,
          },
        },
      )
    }

    if (vendorPlan) {
      await Vendor.updateOne(
        { _id: vendorPlan.vendorId },
        { $set: { ledgerAccountId: vendorPlan.to, updatedBy: actor?._id } },
      )
    }

    console.log(`  [applied] updates saved for ${tx._id}\n`)
  }

  await mongoose.disconnect()
  console.log(apply ? 'Done (applied).' : 'Dry-run complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
