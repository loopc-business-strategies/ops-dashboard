#!/usr/bin/env node
/**
 * Repair Ops visits where a partial allocate left the untouched remainder booked as loss.
 *
 * Only changes a visit when its (Metal IN − Metal OUT) excess exactly equals the IN of the
 * open remainder visit(s) for the same mix + department. Those rows are the real remainder,
 * so the excess is not a loss.
 *
 *   node scripts/repair-alloy-partial-split-loss.js mg --mix=BMG-0002 --dept=vault_room --dry-run
 *   node scripts/repair-alloy-partial-split-loss.js mg --mix=BMG-0002 --dept=vault_room --apply
 */
require('dotenv').config()
const mongoose = require('mongoose')
const OperationsProductionEntry = require('../models/OperationsProductionEntry')

const EPS = 0.0001
const toQty = (n) => Math.round(Number(n) * 1e4) / 1e4

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3).trim() : ''
}

async function main() {
  const tenant = String(process.argv[2] || '').trim().toLowerCase()
  const apply = process.argv.includes('--apply')
  const mix = String(argValue('mix') || '').trim().toUpperCase()
  const dept = String(argValue('dept') || '').trim().toLowerCase()
  if (!tenant || !mix || !dept) {
    console.error('Usage: node scripts/repair-alloy-partial-split-loss.js <tenant> --mix=BMG-0002 --dept=vault_room [--dry-run|--apply]')
    process.exit(1)
  }
  const uriKey = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = String(process.env[uriKey] || '').trim()
  if (!uri) {
    console.error(`Missing ${uriKey}`)
    process.exit(1)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })
  const base = { source: 'gold_alloy', alloyMixCode: mix, departmentKey: dept }

  const visits = await OperationsProductionEntry.find({
    ...base,
    metalIn: { $ne: null },
    metalOut: { $ne: null },
  }).sort({ createdAt: 1 })

  const remainders = await OperationsProductionEntry.find({
    ...base,
    metalIn: { $ne: null },
    $or: [{ metalOut: null }, { metalOut: { $exists: false } }],
  }).sort({ createdAt: 1 })
  const remainderSum = toQty(remainders.reduce((s, r) => s + Number(r.metalIn || 0), 0))

  let changed = 0
  for (const v of visits) {
    const inW = Number(v.metalIn)
    const outW = Number(v.metalOut)
    const excess = toQty(inW - outW)
    const booked = Number(v.metalLoss || 0)
    console.log(`${mix} ${dept} visit ${v._id}: IN ${inW} OUT ${outW} loss ${booked} | excess ${excess} | open remainder IN ${remainderSum}`)
    if (excess <= EPS) continue
    if (!remainders.length || Math.abs(excess - remainderSum) > EPS) {
      console.log('  skip: excess does not match open remainder IN')
      continue
    }
    const newFg = v.fineGold != null && inW > EPS
      ? toQty(Number(v.fineGold) * (outW / inW))
      : v.fineGold
    console.log(`  → IN ${inW} → ${outW}, loss ${booked} → 0${v.fineGold != null ? `, FG ${v.fineGold} → ${newFg}` : ''}${apply ? '' : ' (dry-run)'}`)
    if (apply) {
      v.metalIn = outW
      v.fineGold = newFg
      v.metalLoss = 0
      await v.save()
    }
    changed += 1
  }

  console.log(changed ? `${apply ? 'Updated' : 'Would update'} ${changed} visit(s).` : 'No visits needed repair.')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
