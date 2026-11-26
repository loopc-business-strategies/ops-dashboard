/**
 * Bridges Gold Alloy Post/Update Mix → vault lot + AlloyMixJob + Operations Production rows,
 * and Floor Allocate-to department custody moves.
 */

const { withSession, writeOpts } = require('../../utils/mongoTransaction')
const { nextStockCode } = require('../productionControl/numbering')
const { PRODUCTION_DEPARTMENT_KEYS } = require('../../constants/productionDepartments')
const AlloyMixJob = require('../../models/AlloyMixJob')
const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
const OperationsProductionEntry = require('../../models/OperationsProductionEntry')

const { MIX_CODE_PREFIX, isAlloyMixBatchCode } = require('./alloyMixBatchCode')

const VAULT = 'vault_room'
const QTY_EPS = 1e-9

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

/** 4 dp — align with Gold Alloy calc so 552.3035 / 0.694 are not cut to 3 dp. */
function toQty(n) {
  return Math.round(Number(n || 0) * 10000) / 10000
}

function sumInputComponentGross(components = []) {
  return toQty(
    (Array.isArray(components) ? components : [])
      .reduce((acc, row) => acc + Number(row?.gross || 0), 0),
  )
}

/**
 * After + Add metal extras bump targetGross above Post Mix inputs, Metal Out < target
 * must not scale remains against the bumped gross (that dumps the extras gap onto the
 * last metal and can make copper "gain"). Scale against the recipe input sum instead.
 *
 * @returns {{ action: 'none'|'shrink_extras_only'|'update_mix', scaleBase?: number, nextTarget?: number, fineGold?: number|null }}
 */
function planMetalOutMixShrink({
  priorTarget,
  nextTarget,
  inputGrossSum,
  priorFineGold = null,
  purityPct = null,
} = {}) {
  const prior = toQty(priorTarget)
  const next = toQty(nextTarget)
  const recipe = toQty(inputGrossSum)
  if (!(prior > QTY_EPS) || !(next > QTY_EPS)) return { action: 'none' }
  // Out matches / exceeds current target — no shrink.
  if (next + 0.0005 >= prior) return { action: 'none' }

  const hasExtras = recipe > QTY_EPS && prior > recipe + 0.0005
  const scaleBase = hasExtras ? recipe : prior
  const storedFg = priorFineGold != null && Number.isFinite(Number(priorFineGold))
    ? toQty(priorFineGold)
    : null
  const recipeFg = purityPct != null && scaleBase > QTY_EPS
    ? toQty((scaleBase * Number(purityPct)) / 100)
    : null
  const baseFg = storedFg != null ? storedFg : recipeFg

  // Out still ≥ Post Mix recipe: only non-recipe extras left the bar — keep inputs.
  if (hasExtras && next + 0.0005 >= recipe) {
    return {
      action: 'shrink_extras_only',
      scaleBase: recipe,
      nextTarget: next,
      fineGold: baseFg,
    }
  }

  const fineGold = baseFg != null && scaleBase > QTY_EPS
    ? toQty(Number(baseFg) * (next / scaleBase))
    : (purityPct != null ? toQty((next * Number(purityPct)) / 100) : null)
  return {
    action: 'update_mix',
    scaleBase,
    nextTarget: next,
    fineGold,
  }
}

/** Scale Post Mix remain lines to nextTarget using scaleBase (recipe or prior target). */
function buildUpdatedMixRemainLines(priorInputs = [], { nextTarget, scaleBase } = {}) {
  const next = toQty(nextTarget)
  const base = toQty(scaleBase)
  if (!(next > QTY_EPS) || !(base > QTY_EPS)) return []
  const ratio = next / base
  let allocatedRemain = 0
  return priorInputs.map((c, index) => {
    const priorRemain = toQty(c.gross)
    const consume = toQty(
      c.consumeGross != null && Number(c.consumeGross) > QTY_EPS
        ? c.consumeGross
        : priorRemain,
    )
    const isLast = index === priorInputs.length - 1
    const remain = isLast
      ? toQty(next - allocatedRemain)
      : toQty(priorRemain * ratio)
    if (!isLast) allocatedRemain = toQty(allocatedRemain + remain)
    return {
      itemId: String(c.itemId),
      gross: consume,
      remainGross: remain,
      lossGross: toQty(Math.max(0, priorRemain - remain)),
      role: c.role || '',
      label: c.label || c.role || '',
    }
  }).filter((line) => line.itemId && line.gross > QTY_EPS)
}

/**
 * Fine gold for an allocate/receive move.
 * Prefer stored gold-only FG (set after + Add metal extras). If targetGross was
 * bumped above Post Mix inputs but fineGold was never stored, derive FG from
 * input sum × purity so cadmium/copper extras are not counted as gold.
 */
function resolveAllocateFineGold(job, moveWeight, available) {
  const move = toQty(moveWeight)
  const avail = toQty(available)
  if (!(move > QTY_EPS)) return null
  const purityPct = job?.purity != null ? Number(job.purity) : null
  const scale = (fullFg) => {
    if (!(avail > QTY_EPS) || Math.abs(move - avail) <= QTY_EPS) return toQty(fullFg)
    return toQty(Number(fullFg) * (move / avail))
  }

  const stored = job?.fineGold != null && job.fineGold !== '' ? Number(job.fineGold) : null
  if (stored != null && Number.isFinite(stored) && stored >= 0) {
    return scale(stored)
  }

  const inputSum = sumInputComponentGross(job?.inputComponents)
  const target = toQty(job?.targetGross)
  if (
    purityPct != null
    && inputSum > QTY_EPS
    && target > inputSum + 0.0005
  ) {
    return scale((inputSum * purityPct) / 100)
  }

  if (purityPct != null) return toQty((move * purityPct) / 100)
  return null
}

/**
 * Normalize Post Mix consumed rows into AlloyMixJob.inputComponents.
 * Prefer remainGross (metals in the finished bar) — same grams View mix shows —
 * not the pre-oxidation consume amount when metal loss reduced the mix.
 */
function buildInputComponents(consumed = []) {
  return (Array.isArray(consumed) ? consumed : [])
    .map((row) => {
      const consume = toQty(row?.gross)
      const remainRaw = row?.remainGross
      const remain = remainRaw === '' || remainRaw == null ? null : toQty(remainRaw)
      const gross = remain != null && remain >= 0 && remain <= consume + 0.0005
        ? remain
        : consume
      if (!(gross > QTY_EPS)) return null
      const name = String(row?.name || row?.consumeLabel || row?.label || '').trim()
      if (!name) return null
      return {
        itemId: row?.itemId || null,
        name,
        role: String(row?.role || '').trim().toLowerCase(),
        label: String(row?.label || row?.consumeLabel || '').trim(),
        gross,
        // Original vault take — later Melting/Rolling Updates need this for cumulative AML.
        consumeGross: consume,
      }
    })
    .filter(Boolean)
}

/**
 * When stored input grams still sum above finished target (legacy jobs that kept
 * consume amounts after Update metal loss), scale down to match View mix remain.
 */
function normalizeInputComponentsToTarget(components = [], targetGross) {
  const target = toQty(targetGross)
  const list = (Array.isArray(components) ? components : [])
    .map((row) => {
      const gross = toQty(row?.gross)
      const consumeRaw = row?.consumeGross
      const consumeGross = consumeRaw === '' || consumeRaw == null
        ? null
        : toQty(consumeRaw)
      return {
        itemId: row?.itemId || null,
        name: String(row?.name || '').trim(),
        role: String(row?.role || '').trim(),
        label: String(row?.label || '').trim(),
        gross,
        consumeGross: consumeGross != null && consumeGross > QTY_EPS ? consumeGross : null,
      }
    })
    .filter((row) => row.name && row.gross > QTY_EPS)
  if (!(target > 0) || !list.length) return list
  const sum = toQty(list.reduce((acc, row) => acc + row.gross, 0))
  if (!(sum > target + 0.0005)) return list
  let allocated = 0
  return list.map((row, index) => {
    const isLast = index === list.length - 1
    const remain = isLast
      ? toQty(target - allocated)
      : toQty(row.gross * (target / sum))
    if (!isLast) allocated = toQty(allocated + remain)
    return { ...row, gross: remain }
  }).filter((row) => row.gross > QTY_EPS)
}

/** Scale input grams when a mix is partially allocated (ratio = move / available). */
function scaleInputComponents(components = [], ratio = 1) {
  const r = Number(ratio)
  if (!(r > 0) || !Number.isFinite(r)) return []
  return (Array.isArray(components) ? components : [])
    .map((row) => {
      const gross = toQty(Number(row?.gross || 0) * r)
      if (!(gross > QTY_EPS)) return null
      const consumeRaw = row?.consumeGross
      const consumeGross = consumeRaw === '' || consumeRaw == null
        ? null
        : toQty(Number(consumeRaw) * r)
      return {
        itemId: row?.itemId || null,
        name: String(row?.name || '').trim(),
        role: String(row?.role || '').trim(),
        label: String(row?.label || '').trim(),
        gross,
        ...(consumeGross != null && consumeGross > QTY_EPS ? { consumeGross } : {}),
      }
    })
    .filter(Boolean)
}

function dubaiDateKey(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.MG_FLOOR_TIMEZONE || 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d instanceof Date ? d : new Date(d))
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function normalizeDept(raw) {
  const key = String(raw || '').trim().toLowerCase()
  return PRODUCTION_DEPARTMENT_KEYS.includes(key) ? key : ''
}

/** One workbook visit key — no in/out side (Metal IN + OUT share a single Ops row). */
function opsKey(mixCode, departmentKey, stamp) {
  return `alloy:${String(mixCode).toUpperCase()}:${departmentKey}:${stamp}`
}

/** Open gold_alloy visit in a department: has Metal IN, still waiting for Metal OUT. */
async function findOpenAlloyOpsVisit({ session, mixCode, departmentKey }) {
  const code = String(mixCode || '').toUpperCase()
  if (!code || !departmentKey) return null
  return withSession(
    OperationsProductionEntry.findOne({
      source: 'gold_alloy',
      alloyMixCode: code,
      departmentKey,
      metalIn: { $ne: null },
      $or: [{ metalOut: null }, { metalOut: { $exists: false } }],
    }).sort({ updatedAt: -1, createdAt: -1 }),
    session,
  )
}

/** Drop an open dest visit (allocate wrote IN; receive was rejected). */
async function removeOpenAlloyOpsVisit({ session, mixCode, departmentKey }) {
  const open = await findOpenAlloyOpsVisit({ session, mixCode, departmentKey })
  if (!open) return null
  await open.deleteOne(writeOpts(session))
  return open
}

/**
 * Merge legacy split rows (opsKey used to include :in: / :out:) onto one visit per
 * mix + department. Also drops OUT-only orphans when a completed visit already
 * exists (Floor OUT closed Melting/Rolling before allocate → Vault). Safe to repeat.
 */
async function mergeSplitAlloyOpsRows({ session = null, mixCode = '' } = {}) {
  const filter = {
    source: 'gold_alloy',
    alloyMixCode: { $nin: [null, ''] },
    metalOut: { $ne: null },
    $or: [{ metalIn: null }, { metalIn: { $exists: false } }],
  }
  const code = String(mixCode || '').toUpperCase()
  if (code) filter.alloyMixCode = code

  const outOnly = await withSession(
    OperationsProductionEntry.find(filter).sort({ createdAt: 1 }),
    session,
  )
  let merged = 0
  for (const outRow of outOnly || []) {
    const inRow = await withSession(
      OperationsProductionEntry.findOne({
        source: 'gold_alloy',
        alloyMixCode: outRow.alloyMixCode,
        departmentKey: outRow.departmentKey,
        metalIn: { $ne: null },
        $or: [{ metalOut: null }, { metalOut: { $exists: false } }],
        _id: { $ne: outRow._id },
      }).sort({ createdAt: 1 }),
      session,
    )
    if (inRow) {
      inRow.metalOut = outRow.metalOut
      inRow.purityOut = outRow.purityOut ?? inRow.purityOut
      inRow.fineGoldOut = outRow.fineGoldOut ?? inRow.fineGoldOut
      inRow.batchOverAt = outRow.batchOverAt || inRow.batchOverAt
      if (outRow.floorOutEntryId) inRow.floorOutEntryId = outRow.floorOutEntryId
      const toDept = String(outRow.transferToDepartment || '').trim()
      if (toDept && !inRow.transferToDepartment) inRow.transferToDepartment = toDept
      if (inRow.metalIn != null && inRow.metalOut != null) {
        inRow.metalLoss = Math.max(0, toQty(inRow.metalIn - inRow.metalOut))
      }
      await inRow.save(writeOpts(session))
      await outRow.deleteOne(writeOpts(session))
      merged += 1
      continue
    }

    // Completed visit already has IN+OUT (Floor locked) — orphan allocate OUT is noise.
    const completed = await withSession(
      OperationsProductionEntry.findOne({
        source: 'gold_alloy',
        alloyMixCode: outRow.alloyMixCode,
        departmentKey: outRow.departmentKey,
        metalIn: { $ne: null },
        metalOut: { $ne: null },
        _id: { $ne: outRow._id },
      }).sort({ updatedAt: -1, createdAt: -1 }),
      session,
    )
    if (!completed) continue
    const toDept = String(outRow.transferToDepartment || '').trim()
    if (toDept && !completed.transferToDepartment) {
      completed.transferToDepartment = toDept
      await completed.save(writeOpts(session))
    }
    await outRow.deleteOne(writeOpts(session))
    merged += 1
  }
  return merged
}

async function upsertOpsRow({
  session,
  mixCode,
  departmentKey,
  date,
  batchNumber,
  side,
  weight,
  purity,
  fineGold,
  employeeName,
  actor,
  stamp,
  fromDepartment = '',
  toDepartment = '',
}) {
  const code = String(mixCode || '').toUpperCase()
  const fromRaw = String(fromDepartment || '').trim().toLowerCase()
  const fromDept = normalizeDept(fromDepartment) || (
    fromRaw === 'post_mix' || fromRaw === 'update_mix' ? fromRaw : ''
  )
  const toDept = normalizeDept(toDepartment) || ''
  const setBase = {
    source: 'gold_alloy',
    departmentKey,
    date,
    batchNumber: String(batchNumber || mixCode).trim(),
    departmentManagerName: actor?.name || '',
    alloyMixCode: code,
  }

  // Metal OUT merges onto the open Metal IN visit for this mix + department.
  if (side === 'out') {
    const open = await findOpenAlloyOpsVisit({ session, mixCode: code, departmentKey })
    if (open) {
      // FM-approved Floor Metal Out already stamped OUT gross + Post Mix purity —
      // keep those weights (do not replace with full allocate targetGross).
      const floorOutLocked = Boolean(open.floorOutEntryId)
        && open.metalOut != null
        && Number.isFinite(Number(open.metalOut))
      if (!floorOutLocked) {
        open.metalOut = weight
        open.purityOut = purity ?? null
        open.fineGoldOut = fineGold ?? null
      }
      open.batchOverAt = open.batchOverAt || new Date()
      open.floorOutEntryId = open.floorOutEntryId || opsKey(code, departmentKey, `out-${stamp}`)
      open.departmentManagerName = actor?.name || open.departmentManagerName
      if (toDept) open.transferToDepartment = toDept
      if (open.metalIn != null && open.metalOut != null) {
        open.metalLoss = Math.max(0, toQty(open.metalIn - open.metalOut))
      }
      await open.save(writeOpts(session))
      return open
    }

    // Floor Metal Out often closes Melting/Rolling before allocate → Vault.
    // Do NOT create a second OUT-only row (orphan noise); stamp transferTo on the
    // completed visit and keep Floor OUT weights (same as live: one visit per dept).
    const closed = await withSession(
      OperationsProductionEntry.findOne({
        source: 'gold_alloy',
        alloyMixCode: code,
        departmentKey,
        metalIn: { $ne: null },
        metalOut: { $ne: null },
      }).sort({ updatedAt: -1, createdAt: -1 }),
      session,
    )
    if (closed) {
      if (toDept) closed.transferToDepartment = toDept
      closed.departmentManagerName = actor?.name || closed.departmentManagerName
      await closed.save(writeOpts(session))
      return closed
    }
  }

  const floorBatchKey = opsKey(code, departmentKey, stamp)
  const set = { ...setBase }
  const setOnInsert = {
    createdById: actor?._id || null,
    createdByName: actor?.name || '',
    employeeName: employeeName || actor?.name || '',
  }
  if (side === 'in') {
    Object.assign(set, {
      metalIn: weight,
      purity: purity ?? null,
      fineGold: fineGold ?? null,
      batchStartedAt: new Date(),
      floorInEntryId: floorBatchKey,
      ...(fromDept ? { transferFromDepartment: fromDept } : {}),
    })
  } else {
    Object.assign(set, {
      metalOut: weight,
      purityOut: purity ?? null,
      fineGoldOut: fineGold ?? null,
      batchOverAt: new Date(),
      floorOutEntryId: floorBatchKey,
      ...(toDept ? { transferToDepartment: toDept } : {}),
    })
  }

  const opts = {
    ...writeOpts(session),
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  }
  let row
  try {
    row = await OperationsProductionEntry.findOneAndUpdate(
      { floorBatchKey },
      { $set: set, $setOnInsert: setOnInsert },
      opts,
    )
  } catch (err) {
    if (err?.code !== 11000) throw err
    row = await OperationsProductionEntry.findOneAndUpdate(
      { floorBatchKey },
      { $set: set },
      { ...opts, upsert: false },
    )
  }
  if (!row) return null
  if (row.metalIn != null && row.metalOut != null) {
    row.metalLoss = Math.max(0, toQty(row.metalIn - row.metalOut))
    await row.save(writeOpts(session))
  }
  return row
}

/**
 * On reverse/Update: drop only *open* Ops visits (Metal IN, no Metal OUT yet).
 * Keep completed Melting/Bangle/Vault history under the same BMG batch so
 * Ops Production + Production Dashboard still show IN/OUT after Update.
 *
 * Vault returns from a floor department (from Melting / Rolling / …) are closed
 * as history (OUT = IN) instead of deleted — otherwise Update Mix erases those rows.
 */
async function softDeleteOpsForMix({ session, mixCode, actor, reason }) {
  const code = String(mixCode || '').toUpperCase()
  if (!code) return 0
  const rows = await withSession(
    OperationsProductionEntry.find({
      $or: [
        { alloyMixCode: code },
        { floorBatchKey: { $regex: `^alloy:${code}:` } },
      ],
    }),
    session,
  )
  const deletedAt = new Date()
  let n = 0
  for (const row of rows || []) {
    if (String(row.source || '') !== 'gold_alloy' && !String(row.floorBatchKey || '').startsWith(`alloy:${code}:`)) {
      continue
    }
    // Completed visit (has Metal OUT / Over time) — keep for department history.
    const hasOut = row.metalOut != null && Number.isFinite(Number(row.metalOut))
    const hasOver = Boolean(row.batchOverAt)
    if (hasOut || hasOver) continue

    const dept = normalizeDept(row.departmentKey)
    const fromRaw = String(row.transferFromDepartment || '').trim().toLowerCase()
    const fromDept = normalizeDept(fromRaw) || (
      fromRaw === 'post_mix' || fromRaw === 'update_mix' ? fromRaw : ''
    )
    // Vault return from Melting/Rolling/… after Metal Out: leave open so Updated Mix
    // can promote that same row (Post → Melting OUT → one back-to-Vault visit).
    if (dept === VAULT && fromDept && fromDept !== 'post_mix' && fromDept !== 'update_mix') {
      continue
    }
    // Keep Vault Post Mix / prior Updated Mix history: close open IN as OUT=IN.
    if (dept === VAULT && fromDept) {
      const inn = row.metalIn != null && Number.isFinite(Number(row.metalIn)) ? toQty(row.metalIn) : null
      if (inn != null) {
        row.metalOut = inn
        if (row.purityOut == null && row.purity != null) row.purityOut = row.purity
        if (row.fineGoldOut == null && row.fineGold != null) row.fineGoldOut = row.fineGold
        row.metalLoss = 0
        row.batchOverAt = row.batchOverAt || new Date()
        if (!row.floorOutEntryId) {
          row.floorOutEntryId = `${row.floorBatchKey || opsKey(code, VAULT, 'ret')}:update-close`
        }
        await row.save(writeOpts(session))
        continue
      }
    }

    await row.deleteOne(writeOpts(session))
    n += 1
  }
  void deletedAt
  void actor
  void reason
  return n
}

/** Archive a live BMG code so Update can reuse the same batch number. */
function archiveMixCode(mixCode = '') {
  const code = String(mixCode || '').trim().toUpperCase()
  if (!code) return code
  if (code.includes('__REV__')) return code
  return `${code}__REV__${Date.now()}`
}

function parseMixCodeSequence(mixCode = '', prefix = MIX_CODE_PREFIX) {
  const m = String(mixCode || '').trim().toUpperCase()
    .match(new RegExp(`^${prefix}(\\d+)`, 'i'))
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/** Next mix/batch code: BMG-0001, BMG-0002, … (counts archived __REV__ codes too). */
async function nextMixCode(session) {
  const prefix = MIX_CODE_PREFIX
  const rows = await withSession(
    AlloyMixJob.find({ mixCode: new RegExp(`^${prefix}\\d+`, 'i') })
      .select('mixCode')
      .lean(),
    session,
  )
  let seq = 1
  for (const row of rows || []) {
    const n = parseMixCodeSequence(row?.mixCode, prefix)
    if (n != null) seq = Math.max(seq, n + 1)
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}

function formatMixCode(sequence) {
  const n = Number(sequence)
  if (!Number.isFinite(n) || n < 1) return ''
  return `${MIX_CODE_PREFIX}${String(n).padStart(4, '0')}`
}

async function resolveMixCode({ session, preferredMixCode = '' } = {}) {
  const raw = String(preferredMixCode || '').trim().toUpperCase()
  const seq = parseMixCodeSequence(raw)
  const preferred = seq != null ? formatMixCode(seq) : ''
  if (preferred) {
    const clash = await withSession(
      AlloyMixJob.findOne({ mixCode: preferred }).select('_id mixCode').lean(),
      session,
    )
    if (!clash) return preferred
    // Explicit batch from New/Edit mix — do not silently mint the next number.
    throw httpError(400, `Batch ${preferred} is already in use`)
  }
  return nextMixCode(session)
}

/**
 * After ERP postAlloyMix succeeds: mint vault lot + Mix Job + vault Ops IN.
 */
async function createJobFromPostedMix({
  user,
  session = null,
  postResult,
  karat,
  finishedPurity = null,
  preferredMixCode = '',
} = {}) {
  if (!postResult?.success || !postResult?.finishedProduct?.id) {
    return null
  }

  const reasonBase = String(postResult.reason || '').trim()
  const targetGross = toQty(postResult.targetGross)
  const metalLossGross = toQty(postResult.metalLossGross || 0)
  const metalLossByMetal = (Array.isArray(postResult.metalLossByMetal) ? postResult.metalLossByMetal : [])
    .map((row) => ({
      itemId: row?.itemId || null,
      name: String(row?.name || '').trim(),
      label: String(row?.label || '').trim(),
      stockCode: String(row?.stockCode || '').trim().toUpperCase(),
      lossGross: toQty(row?.lossGross || 0),
    }))
    .filter((row) => row.lossGross > QTY_EPS)
  const finishedId = postResult.finishedProduct.id
  const finishedName = postResult.finishedProduct.name || ''
  const inputComponents = buildInputComponents(postResult.consumed)
  const actorId = user?._id || null
  const actorName = user?.name || ''

  // Update mix passes preferredMixCode so the same BMG batch is reused.
  const mixCode = await resolveMixCode({ session, preferredMixCode })
  const purityLabel = finishedPurity != null && Number(finishedPurity) > 0
    ? String(Math.round(Number(finishedPurity) * 1000) / 10)
    : ''
  const purityPct = finishedPurity != null && Number(finishedPurity) > 0
    ? Math.round(Number(finishedPurity) * 10000) / 100
    : null
  // Prefer recipe input sum when target was bumped above Post Mix (extras) so FG
  // stays gold-only rather than targetGross × purity.
  const recipeGross = sumInputComponentGross(inputComponents)
  const fgBase = recipeGross > QTY_EPS && targetGross > recipeGross + 0.0005
    ? recipeGross
    : targetGross
  const fineGold = purityPct != null ? toQty((fgBase * purityPct) / 100) : null

  let stockCode = mixCode
  const clash = await withSession(
    ProductionStockLot.findOne({ stockCode }).select('_id').lean(),
    session,
  )
  if (clash) {
    stockCode = await nextStockCode(ProductionStockLot, session)
  }

  const idempotencyKey = `alloy-mix:${reasonBase}`
  let lot = await withSession(
    ProductionStockLot.findOne({ idempotencyKey }),
    session,
  )
  if (!lot) {
    try {
      ;[lot] = await ProductionStockLot.create(
        [
          {
            stockCode,
            purchaseRef: mixCode,
            batchNumber: mixCode,
            supplier: 'Gold Alloy',
            purchaseDate: new Date(),
            product: finishedName || 'Alloy mix',
            productCode: '',
            category: `alloyMix=${mixCode};karat=${Number(karat) || ''}`,
            quantity: 1,
            grossWeight: targetGross,
            netWeight: targetGross,
            metalType: 'Gold',
            purity: purityLabel,
            remarks: `Gold alloy mix ${mixCode}: ${reasonBase}`,
            receivedById: actorId,
            receivedByName: actorName,
            status: 'NEW_STOCK',
            inventoryItemId: finishedId,
            createdById: actorId,
            createdByName: actorName,
            version: 0,
            idempotencyKey,
          },
        ],
        writeOpts(session),
      )
      await ProductionStockStatusEvent.create(
        [
          {
            stockLotId: lot._id,
            stockCode: lot.stockCode,
            fromStatus: '',
            toStatus: 'NEW_STOCK',
            reason: `Alloy mix posted ${mixCode}`,
            actorId,
            actorName,
          },
        ],
        writeOpts(session),
      )
    } catch (err) {
      if (err?.code === 11000) {
        lot = await withSession(ProductionStockLot.findOne({ idempotencyKey }), session)
      } else {
        throw err
      }
    }
  }

  const [job] = await AlloyMixJob.create(
    [
      {
        mixCode,
        reasonBase,
        karat: Number(karat) || 0,
        targetGross,
        metalLossGross,
        metalLossByMetal,
        finishedProductId: finishedId,
        finishedProductName: finishedName,
        inputComponents,
        purity: purityPct,
        fineGold,
        stockLotId: lot?._id || null,
        stockCode: lot?.stockCode || stockCode,
        status: 'in_vault',
        currentDepartment: VAULT,
        history: [{
          at: new Date(),
          action: /updated/i.test(reasonBase) ? 'update' : 'post',
          fromDepartment: '',
          toDepartment: VAULT,
          note: reasonBase,
          actorId,
          actorName,
        }],
        createdById: actorId,
        createdByName: actorName,
        updatedById: actorId,
        updatedByName: actorName,
      },
    ],
    writeOpts(session),
  )

  const date = dubaiDateKey()
  const isUpdate = /updated/i.test(String(reasonBase || ''))

  // After Melting Metal Out → return to Vault, reuse that open "from Melting" visit
  // instead of adding a second Updated Mix Vault row for the same stock.
  if (isUpdate) {
    const openVault = await findOpenAlloyOpsVisit({
      session,
      mixCode,
      departmentKey: VAULT,
    })
    if (openVault) {
      const fromRaw = String(openVault.transferFromDepartment || '').trim().toLowerCase()
      const fromFloor = normalizeDept(fromRaw)
      openVault.metalIn = targetGross
      openVault.purity = purityPct ?? openVault.purity ?? null
      openVault.fineGold = fineGold ?? openVault.fineGold ?? null
      openVault.metalOut = null
      openVault.purityOut = null
      openVault.fineGoldOut = null
      openVault.metalLoss = null
      openVault.batchOverAt = null
      openVault.floorOutEntryId = null
      openVault.date = date
      openVault.batchNumber = mixCode
      openVault.alloyMixCode = mixCode
      openVault.departmentManagerName = user?.name || openVault.departmentManagerName || ''
      // Keep physical "from Melting/…" chip; only retag ERP-only stock rows.
      if (!fromFloor) {
        openVault.transferFromDepartment = 'update_mix'
      }
      if (openVault.metalIn != null && openVault.fineGold == null && openVault.purity != null) {
        openVault.fineGold = toQty(openVault.metalIn * (Number(openVault.purity) / 100))
      }
      await openVault.save(writeOpts(session))
      return { job, lot, mixCode }
    }
  }

  // Unique stamp so each Post/Update Mix is its own Vault row (OUT then merges onto that open IN).
  const stamp = isUpdate ? `update-${Date.now()}` : `post-${Date.now()}`
  await upsertOpsRow({
    session,
    mixCode,
    departmentKey: VAULT,
    date,
    batchNumber: mixCode,
    side: 'in',
    weight: targetGross,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
    fromDepartment: isUpdate ? 'update_mix' : 'post_mix',
  })

  return {
    job,
    lot,
    mixCode,
  }
}

function jobInVaultCustody(job) {
  return Boolean(
    job
    && !job.isDeleted
    && job.status === 'in_vault'
    && job.currentDepartment === VAULT,
  )
}

/** BFS open (non-closed) descendants for partial-allocate child trees. */
async function listOpenDescendantJobs(rootId, session = null) {
  if (!rootId) return []
  const out = []
  let frontier = [rootId]
  while (frontier.length) {
    const kids = await withSession(
      AlloyMixJob.find({
        parentJobId: { $in: frontier },
        isDeleted: { $ne: true },
        status: { $ne: 'closed' },
      }),
      session,
    )
    const list = Array.isArray(kids) ? kids : []
    if (!list.length) break
    out.push(...list)
    frontier = list.map((row) => row._id)
  }
  return out
}

async function assertDescendantsInVault(job, session = null) {
  const descendants = await listOpenDescendantJobs(job?._id, session)
  const onFloor = descendants.filter((row) => !jobInVaultCustody(row))
  if (onFloor.length) {
    const sample = onFloor
      .slice(0, 3)
      .map((row) => `${row.mixCode}@${row.currentDepartment}`)
      .join(', ')
    throw httpError(
      400,
      `Cannot reverse/update mix ${job.mixCode}: split portion still on floor (${sample}). `
      + 'Allocate child mix(es) back to Vault Room first.',
    )
  }
  return descendants
}

async function closeSingleJobRecord(job, {
  user,
  session = null,
  reason = '',
  note = 'Reversed / closed for update',
} = {}) {
  if (!job || job.isDeleted || job.status === 'closed') return job

  const liveMixCode = String(job.mixCode || '').trim().toUpperCase()
  const archivedCode = archiveMixCode(liveMixCode)

  if (job.stockLotId) {
    const lot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
    if (lot && String(lot.status || '') !== 'CANCELLED') {
      const fromStatus = lot.status
      lot.status = 'CANCELLED'
      // Free stockCode so Update can recreate a vault lot under the same BMG batch.
      if (archivedCode && archivedCode !== liveMixCode
        && String(lot.stockCode || '').toUpperCase() === liveMixCode) {
        lot.stockCode = archivedCode
        if (String(lot.batchNumber || '').toUpperCase() === liveMixCode) {
          lot.batchNumber = archivedCode
        }
        if (String(lot.purchaseRef || '').toUpperCase() === liveMixCode) {
          lot.purchaseRef = archivedCode
        }
      }
      lot.remarks = `${lot.remarks || ''} | Reversed alloy mix ${liveMixCode}`.trim()
      await lot.save(writeOpts(session))
      await ProductionStockStatusEvent.create(
        [
          {
            stockLotId: lot._id,
            stockCode: lot.stockCode,
            fromStatus,
            toStatus: 'CANCELLED',
            reason: `Alloy mix reversed ${liveMixCode}`,
            actorId: user?._id || null,
            actorName: user?.name || '',
          },
        ],
        writeOpts(session),
      )
    }
  }

  await softDeleteOpsForMix({
    session,
    mixCode: liveMixCode,
    actor: user,
    reason: reason || `Reversed ${liveMixCode}`,
  })

  // Free BMG-#### for Update mix reuse (unique index). Keep archive for audit / nextMixCode.
  if (archivedCode && archivedCode !== liveMixCode) {
    job.mixCode = archivedCode
    if (job.stockCode && String(job.stockCode).toUpperCase() === liveMixCode) {
      job.stockCode = archivedCode
    }
  }

  job.status = 'closed'
  job.closedAt = new Date()
  job.isDeleted = true
  job.deletedAt = new Date()
  job.deletedBy = user?._id || null
  job.deleteReason = reason ? `Reversed: ${reason}` : `Reversed: ${liveMixCode}`
  job.updatedById = user?._id || null
  job.updatedByName = user?.name || ''
  job.history.push({
    at: new Date(),
    action: 'close',
    fromDepartment: job.currentDepartment,
    toDepartment: '',
    note: archivedCode !== liveMixCode
      ? `${note} · archived ${liveMixCode} → ${archivedCode}`
      : note,
    actorId: user?._id || null,
    actorName: user?.name || '',
  })
  await job.save(writeOpts(session))
  return job
}

/**
 * Before / during reverse: require in_vault (or already closed), cancel lot, delete ops, close job.
 * Also closes in-vault partial-allocate descendants so ERP reverse cannot orphan floor/vault splits.
 */
async function closeJobForReverse({
  user,
  session = null,
  reasonBase,
  allowMissing = true,
  force = false,
} = {}) {
  const reason = String(reasonBase || '').trim()
  if (!reason) return null

  const job = await withSession(
    AlloyMixJob.findOne({ reasonBase: reason, isDeleted: { $ne: true } }),
    session,
  )
  if (!job) {
    if (allowMissing) return null
    throw httpError(404, 'Alloy mix job not found for this posted mix')
  }

  if (!force && job.status !== 'in_vault' && job.status !== 'closed') {
    throw httpError(
      400,
      `Cannot reverse/update mix ${job.mixCode}: currently in ${job.currentDepartment}. `
      + 'Allocate back to Vault Room first.',
    )
  }

  const descendants = force
    ? await listOpenDescendantJobs(job._id, session)
    : await assertDescendantsInVault(job, session)

  // Deepest-first so child lots/ops clear before parent.
  for (const child of [...descendants].reverse()) {
    await closeSingleJobRecord(child, {
      user,
      session,
      reason,
      note: `Reversed with parent ${job.mixCode}`,
    })
  }

  await closeSingleJobRecord(job, {
    user,
    session,
    reason,
    note: 'Reversed / closed for update',
  })
  return job
}

async function findOpenJobByReason(reasonBase, session = null) {
  return withSession(
    AlloyMixJob.findOne({
      reasonBase: String(reasonBase || '').trim(),
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }),
    session,
  )
}

async function assertJobUpdatableByReason(reasonBase, session = null) {
  const job = await findOpenJobByReason(reasonBase, session)
  if (!job) return null
  if (job.status !== 'in_vault' || job.currentDepartment !== VAULT) {
    throw httpError(
      400,
      `Mix ${job.mixCode} is in ${job.currentDepartment}. Return it to Vault Room before Update mix.`,
    )
  }
  await assertDescendantsInVault(job, session)
  return job
}

async function touchLotDepartment({
  session,
  lotId,
  mixCode,
  dest,
  actorId,
  actorName,
}) {
  if (!lotId) return null
  const lot = await withSession(ProductionStockLot.findById(lotId), session)
  if (!lot) return null
  lot.remarks = `Alloy ${mixCode} @ ${dest}`
  if (dest === VAULT && lot.status !== 'NEW_STOCK') {
    const fromStatus = lot.status
    lot.status = 'NEW_STOCK'
    await lot.save(writeOpts(session))
    await ProductionStockStatusEvent.create(
      [
        {
          stockLotId: lot._id,
          stockCode: lot.stockCode,
          fromStatus,
          toStatus: 'NEW_STOCK',
          reason: `Returned to vault ${mixCode}`,
          actorId,
          actorName,
        },
      ],
      writeOpts(session),
    )
  } else {
    await lot.save(writeOpts(session))
  }
  return lot
}

/**
 * Floor: move mix from current department to next (including back to vault).
 * Optional `weight` < job.targetGross splits a child Mix Job to the destination
 * and leaves the remainder in place.
 */
async function allocateMixJob({
  user,
  mixId,
  toDepartment,
  note = '',
  weight: weightRaw = null,
  /** Optional FG override (e.g. gold-only FG after + Add metal non-gold lines). */
  fineGold: fineGoldRaw = null,
  session = null,
} = {}) {
  if (!user?._id) throw httpError(401, 'Unauthorized')
  const dest = normalizeDept(toDepartment)
  if (!dest) throw httpError(400, 'Select a valid department')

  const job = await withSession(
    AlloyMixJob.findOne({
      $or: [
        { _id: mixId },
        { mixCode: String(mixId || '').toUpperCase() },
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }),
    session,
  )
  if (!job) throw httpError(404, 'Alloy mix job not found')
  if (job.status === 'pending_receive') {
    throw httpError(
      409,
      `Mix ${job.mixCode} is waiting for receive approval in ${job.currentDepartment}. `
        + 'Approve or reject it on that department tablet first.',
    )
  }

  const from = job.currentDepartment
  if (from === dest) {
    throw httpError(400, `Mix is already in ${dest}`)
  }

  const available = toQty(job.targetGross)
  if (!(available > QTY_EPS)) {
    throw httpError(400, 'Mix has no remaining weight to allocate')
  }

  let moveWeight = available
  if (weightRaw != null && weightRaw !== '') {
    moveWeight = toQty(weightRaw)
    if (!(moveWeight > QTY_EPS)) {
      throw httpError(400, 'Allocate weight must be positive')
    }
    if (moveWeight > available + QTY_EPS) {
      throw httpError(400, `Only ${available} g available to allocate`)
    }
  }
  const isPartial = moveWeight + QTY_EPS < available
  const remainWeight = toQty(available - moveWeight)

  const purityPct = job.purity != null ? Number(job.purity) : null
  const fineGoldOverride = fineGoldRaw != null && fineGoldRaw !== '' ? toQty(fineGoldRaw) : null
  const fineGold = fineGoldOverride != null && fineGoldOverride >= 0
    ? fineGoldOverride
    : resolveAllocateFineGold(job, moveWeight, available)
  // Keep gold-only FG on the job so the next vault→floor allocate does not
  // recompute FG as (bumped targetGross × purity) after + Add metal extras.
  if (fineGoldOverride != null && fineGoldOverride >= 0 && !isPartial) {
    job.fineGold = fineGoldOverride
  }
  const date = dubaiDateKey()
  const stamp = `${Date.now()}`
  const noteText = [
    String(note || '').trim(),
    isPartial ? `partial ${moveWeight} g` : '',
  ].filter(Boolean).join(' · ')

  // Heal any pre-fix split IN/OUT rows for this mix before writing Metal OUT.
  await mergeSplitAlloyOpsRows({ session, mixCode: job.mixCode })

  const action = dest === VAULT ? 'return_vault' : 'allocate'
  /** Floor dests wait for receive Approve/Reject; vault return is immediate.
   * Ops Metal IN is written for every dest at allocate so visit history shows. */
  const offerReceive = dest !== VAULT
  const childStatus = dest === VAULT ? 'in_vault' : 'pending_receive'

  if (isPartial) {
    const childCode = await nextMixCode(session)
    let childLot = null
    if (job.stockLotId) {
      const parentLot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
      if (parentLot) {
        parentLot.grossWeight = remainWeight
        parentLot.netWeight = remainWeight
        parentLot.remarks = `Alloy ${job.mixCode} remainder @ ${from}`
        await parentLot.save(writeOpts(session))

        let childStockCode = `${parentLot.stockCode}-P`
        const clash = await withSession(
          ProductionStockLot.findOne({ stockCode: childStockCode }).select('_id').lean(),
          session,
        )
        if (clash) {
          childStockCode = await nextStockCode(ProductionStockLot, session)
        }
        ;[childLot] = await ProductionStockLot.create(
          [
            {
              stockCode: childStockCode,
              purchaseRef: childCode,
              batchNumber: childCode,
              supplier: 'Gold Alloy split',
              purchaseDate: new Date(),
              product: job.finishedProductName || parentLot.product || 'Alloy mix',
              productCode: parentLot.productCode || '',
              category: parentLot.category || '',
              quantity: 1,
              grossWeight: moveWeight,
              netWeight: moveWeight,
              metalType: parentLot.metalType || 'Gold',
              purity: parentLot.purity || '',
              remarks: `Split from ${job.mixCode} → ${dest}`,
              receivedById: user._id,
              receivedByName: user.name || '',
              status: dest === VAULT ? 'NEW_STOCK' : (parentLot.status || 'NEW_STOCK'),
              inventoryItemId: job.finishedProductId,
              parentLotId: parentLot._id,
              createdById: user._id,
              createdByName: user.name || '',
              version: 0,
              idempotencyKey: `alloy-split:${job.mixCode}:${stamp}`,
            },
          ],
          writeOpts(session),
        )
        parentLot.childLotIds = [...(parentLot.childLotIds || []), childLot._id]
        await parentLot.save(writeOpts(session))
      }
    }

    const splitRatio = available > QTY_EPS ? moveWeight / available : 1
    const childInputs = scaleInputComponents(job.inputComponents, splitRatio)
    const remainInputs = scaleInputComponents(job.inputComponents, remainWeight / available)
    const parentFgBefore = job.fineGold != null && Number.isFinite(Number(job.fineGold))
      ? toQty(job.fineGold)
      : null
    const childFineGold = fineGold
    const remainFineGold = parentFgBefore != null
      ? toQty(parentFgBefore - (childFineGold != null ? childFineGold : 0))
      : (fineGold != null && available > QTY_EPS
        ? toQty(Number(fineGold) * (remainWeight / available))
        : null)

    const [child] = await AlloyMixJob.create(
      [
        {
          mixCode: childCode,
          reasonBase: `${job.reasonBase} · split ${moveWeight} g`,
          karat: job.karat,
          targetGross: moveWeight,
          metalLossGross: 0,
          finishedProductId: job.finishedProductId,
          finishedProductName: job.finishedProductName,
          inputComponents: childInputs,
          purity: job.purity,
          fineGold: childFineGold,
          stockLotId: childLot?._id || null,
          stockCode: childLot?.stockCode || '',
          parentJobId: job._id,
          status: childStatus,
          currentDepartment: dest,
          pendingFromDepartment: offerReceive ? from : '',
          history: [{
            at: new Date(),
            action,
            fromDepartment: from,
            toDepartment: dest,
            note: noteText || `Split from ${job.mixCode}`,
            actorId: user._id,
            actorName: user.name || '',
          }],
          createdById: user._id,
          createdByName: user.name || '',
          updatedById: user._id,
          updatedByName: user.name || '',
        },
      ],
      writeOpts(session),
    )

    await upsertOpsRow({
      session,
      mixCode: job.mixCode,
      departmentKey: from,
      date,
      batchNumber: job.mixCode,
      side: 'out',
      weight: moveWeight,
      purity: purityPct,
      fineGold,
      actor: user,
      stamp,
      toDepartment: dest,
    })
    // Dest Metal IN always — every department keeps a visit row (Vault, Melting, Bangle…).
    // Floor still waits for receive Approve before status becomes in_department.
    await upsertOpsRow({
      session,
      mixCode: child.mixCode,
      departmentKey: dest,
      date,
      batchNumber: child.mixCode,
      side: 'in',
      weight: moveWeight,
      purity: purityPct,
      fineGold,
      actor: user,
      stamp,
      fromDepartment: from,
    })

    job.targetGross = remainWeight
    job.inputComponents = remainInputs
    if (remainFineGold != null && remainFineGold >= 0) {
      job.fineGold = remainFineGold
    }
    job.history.push({
      at: new Date(),
      action: 'allocate',
      fromDepartment: from,
      toDepartment: dest,
      note: noteText || `Split ${moveWeight} g → ${child.mixCode}`,
      actorId: user._id,
      actorName: user.name || '',
    })
    job.updatedById = user._id
    job.updatedByName = user.name || ''
    await job.save(writeOpts(session))

    return { parent: job, child, partial: true, pendingReceive: offerReceive }
  }

  await upsertOpsRow({
    session,
    mixCode: job.mixCode,
    departmentKey: from,
    date,
    batchNumber: job.mixCode,
    side: 'out',
    weight: moveWeight,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
    toDepartment: dest,
  })
  // Dest Metal IN always — Melting/Bangle/etc keep the visit as soon as metal is sent,
  // same as Vault return. Receive Approve no longer creates a second IN.
  await upsertOpsRow({
    session,
    mixCode: job.mixCode,
    departmentKey: dest,
    date,
    batchNumber: job.mixCode,
    side: 'in',
    weight: moveWeight,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
    fromDepartment: from,
  })

  job.history.push({
    at: new Date(),
    action,
    fromDepartment: from,
    toDepartment: dest,
    note: noteText,
    actorId: user._id,
    actorName: user.name || '',
  })
  job.currentDepartment = dest
  job.status = dest === VAULT ? 'in_vault' : 'pending_receive'
  job.pendingFromDepartment = offerReceive ? from : ''
  job.updatedById = user._id
  job.updatedByName = user.name || ''
  await job.save(writeOpts(session))

  if (!offerReceive) {
    await touchLotDepartment({
      session,
      lotId: job.stockLotId,
      mixCode: job.mixCode,
      dest,
      actorId: user._id,
      actorName: user.name || '',
    })
  }

  return job
}

/**
 * Destination department Accept/Reject an offered alloy mix (pending_receive).
 * Allocate already wrote dest gold_alloy Ops Metal IN (visit ledger). Approve →
 * in_department + seed Metal In for FM (attaches to that Ops row — no second IN).
 * Reject → return to pendingFromDepartment and drop the open dest Ops visit.
 */
async function receiveMixJob({
  user,
  mixId,
  decision,
  note = '',
  actorDepartment = '',
  session = null,
} = {}) {
  if (!user?._id) throw httpError(401, 'Unauthorized')
  const decided = String(decision || '').trim().toUpperCase()
  if (decided !== 'APPROVED' && decided !== 'REJECTED') {
    throw httpError(400, 'decision must be APPROVED or REJECTED')
  }

  const job = await withSession(
    AlloyMixJob.findOne({
      $or: [
        { _id: mixId },
        { mixCode: String(mixId || '').toUpperCase() },
      ],
      isDeleted: { $ne: true },
      status: 'pending_receive',
    }),
    session,
  )
  if (!job) throw httpError(404, 'No pending alloy mix receive found')

  const dest = job.currentDepartment
  const actorDept = normalizeDept(actorDepartment)
  if (actorDept && actorDept !== dest && user.role !== 'super_admin') {
    throw httpError(403, `Only ${dest} operators can approve or reject this receive`)
  }
  const from = normalizeDept(job.pendingFromDepartment) || VAULT
  const purityPct = job.purity != null ? Number(job.purity) : null
  const weight = toQty(job.targetGross)
  const fineGold = resolveAllocateFineGold(job, weight, weight)
  const date = dubaiDateKey()
  const stamp = `recv-${Date.now()}`
  const noteText = String(note || '').trim()

  if (decided === 'REJECTED') {
    await removeOpenAlloyOpsVisit({
      session,
      mixCode: job.mixCode,
      departmentKey: dest,
    })
    job.history.push({
      at: new Date(),
      action: 'receive_reject',
      fromDepartment: dest,
      toDepartment: from,
      note: noteText || 'Receive rejected',
      actorId: user._id,
      actorName: user.name || '',
    })
    job.currentDepartment = from
    job.status = from === VAULT ? 'in_vault' : 'in_department'
    job.pendingFromDepartment = ''
    job.updatedById = user._id
    job.updatedByName = user.name || ''
    await job.save(writeOpts(session))
    await touchLotDepartment({
      session,
      lotId: job.stockLotId,
      mixCode: job.mixCode,
      dest: from,
      actorId: user._id,
      actorName: user.name || '',
    })
    return { job, decision: decided, metalInEntry: null }
  }

  // Metal IN was written at allocate so Melting/Bangle already show the visit.
  // Only create IN if missing (older allocate path / heal).
  const openDestVisit = await findOpenAlloyOpsVisit({
    session,
    mixCode: job.mixCode,
    departmentKey: dest,
  })
  if (!openDestVisit) {
    await upsertOpsRow({
      session,
      mixCode: job.mixCode,
      departmentKey: dest,
      date,
      batchNumber: job.mixCode,
      side: 'in',
      weight,
      purity: purityPct,
      fineGold,
      actor: user,
      stamp,
    })
  }

  job.history.push({
    at: new Date(),
    action: 'receive_approve',
    fromDepartment: from,
    toDepartment: dest,
    note: noteText || 'Receive approved',
    actorId: user._id,
    actorName: user.name || '',
  })
  job.status = 'in_department'
  job.pendingFromDepartment = ''
  job.updatedById = user._id
  job.updatedByName = user.name || ''
  await job.save(writeOpts(session))

  await touchLotDepartment({
    session,
    lotId: job.stockLotId,
    mixCode: job.mixCode,
    dest,
    actorId: user._id,
    actorName: user.name || '',
  })

  let metalInEntry = null
  try {
    const { createSystemPendingMetalIn } = require('../mgFloor/batchEntries')
    // Seed one finished-alloy line (Post Mix product + purity), not Gold/Copper inputs.
    const finishedName = String(job.finishedProductName || '').trim()
      || (Number(job.karat) > 0 ? `${Number(job.karat)}K alloyed gold` : '')
    const finishedLines = finishedName
      ? [{ metal: finishedName, qty: weight, purity: purityPct }]
      : []
    const seeded = await createSystemPendingMetalIn({
      department: dest,
      batchLabel: job.mixCode,
      entryDate: date,
      qty: weight,
      purity: purityPct,
      employeeId: user._id,
      employeeName: user.name || '',
      mixCode: job.mixCode,
      lines: finishedLines.length ? finishedLines : undefined,
    })
    metalInEntry = seeded?.entry || null
  } catch (err) {
    // Receive still succeeds; operator can open Metal In manually with the AMX batch.
    console.warn('[alloy-mix] seed Metal In failed:', err?.message || err)
  }

  return { job, decision: decided, metalInEntry }
}

async function listMixJobs({
  department = '',
  status = '',
  includeClosed = false,
} = {}) {
  const filter = {}
  if (!includeClosed) {
    filter.isDeleted = { $ne: true }
    filter.status = { $ne: 'closed' }
  }
  const dept = normalizeDept(department)
  if (dept) filter.currentDepartment = dept
  if (status && ALLOY_MIX_JOB_STATUSES_SAFE.includes(status)) {
    filter.status = status
  }
  return AlloyMixJob.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
}

const ALLOY_MIX_JOB_STATUSES_SAFE = ['in_vault', 'pending_receive', 'in_department', 'closed']

/** Build parentId → open children map for custody annotations. */
async function loadOpenChildrenByParent(session = null) {
  const rows = await withSession(
    AlloyMixJob.find({
      parentJobId: { $ne: null },
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }).select('_id parentJobId status currentDepartment isDeleted mixCode').lean(),
    session,
  )
  const byParent = new Map()
  for (const row of rows || []) {
    const key = String(row.parentJobId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(row)
  }
  return byParent
}

function hasOpenFloorDescendant(rootId, childrenByParent) {
  if (!rootId || !childrenByParent) return false
  const stack = [String(rootId)]
  const seen = new Set()
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    for (const kid of childrenByParent.get(id) || []) {
      if (!jobInVaultCustody(kid)) return true
      stack.push(String(kid._id))
    }
  }
  return false
}

function serializeJob(job, {
  hasOpenFloorDescendants = false,
  childrenByParent = null,
} = {}) {
  if (!job) return null
  const row = typeof job.toObject === 'function' ? job.toObject() : job
  const floorDescendants = childrenByParent
    ? hasOpenFloorDescendant(row._id, childrenByParent)
    : Boolean(hasOpenFloorDescendants)
  const inVault = row.status === 'in_vault' && row.currentDepartment === VAULT && !row.isDeleted
  const pendingReceive = row.status === 'pending_receive' && !row.isDeleted
  return {
    id: String(row._id),
    mixCode: row.mixCode,
    /** Canonical batch id for Floor / Ops — same as mixCode for every alloy mix. */
    batchNumber: row.mixCode,
    reasonBase: row.reasonBase,
    karat: row.karat,
    targetGross: row.targetGross,
    metalLossGross: row.metalLossGross,
    metalLossByMetal: (Array.isArray(row.metalLossByMetal) ? row.metalLossByMetal : [])
      .map((c) => ({
        itemId: c.itemId ? String(c.itemId) : '',
        name: String(c.name || '').trim(),
        label: String(c.label || '').trim(),
        stockCode: String(c.stockCode || '').trim().toUpperCase(),
        lossGross: toQty(c.lossGross),
      }))
      .filter((c) => c.lossGross > QTY_EPS),
    finishedProductId: row.finishedProductId ? String(row.finishedProductId) : '',
    finishedProductName: row.finishedProductName || '',
    inputComponents: normalizeInputComponentsToTarget(
      (Array.isArray(row.inputComponents) ? row.inputComponents : [])
        .map((c) => ({
          itemId: c.itemId ? String(c.itemId) : '',
          name: String(c.name || '').trim(),
          role: String(c.role || '').trim(),
          label: String(c.label || '').trim(),
          gross: toQty(c.gross),
        }))
        .filter((c) => c.name && c.gross > QTY_EPS),
      row.targetGross,
    ),
    purity: row.purity,
    fineGold: row.fineGold != null && Number.isFinite(Number(row.fineGold))
      ? toQty(row.fineGold)
      : null,
    stockLotId: row.stockLotId ? String(row.stockLotId) : '',
    stockCode: row.stockCode || '',
    parentJobId: row.parentJobId ? String(row.parentJobId) : '',
    status: row.status,
    currentDepartment: row.currentDepartment,
    pendingFromDepartment: row.pendingFromDepartment || '',
    pendingReceive,
    hasOpenFloorDescendants: floorDescendants,
    canUpdateMix: inVault && !floorDescendants,
    /** Operator may Allocate only when mix is active on this dept (not waiting receive). */
    canAllocate: !pendingReceive && !row.isDeleted && row.status !== 'closed',
    history: row.history || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Backfill inputComponents for jobs posted before that field existed,
 * using StockMovement consume rows for the mix reasonBase.
 */
async function backfillInputComponents(jobs, session = null) {
  const list = Array.isArray(jobs) ? jobs : []
  const need = list.filter((job) => {
    const row = typeof job?.toObject === 'function' ? job.toObject() : job
    return row && !(Array.isArray(row.inputComponents) && row.inputComponents.length)
      && String(row.reasonBase || '').trim()
  })
  if (!need.length) return list

  const StockMovement = require('../../models/StockMovement')
  const reasons = [...new Set(need.map((j) => String(j.reasonBase || '').trim()).filter(Boolean))]
  const reasonMatchers = reasons.map((base) => {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^${escaped}\\s*—\\s*consume\\b`, 'i')
  })
  const consumeMoves = reasonMatchers.length
    ? await withSession(
      StockMovement.find({
        isDeleted: { $ne: true },
        change: { $lt: 0 },
        $or: reasonMatchers.map((rx) => ({ reason: rx })),
      }).select('itemId itemName change reason').lean(),
      session,
    ).catch(() => [])
    : []

  const byReason = new Map()
  for (const move of consumeMoves || []) {
    const text = String(move.reason || '')
    const base = reasons.find((r) => text.toLowerCase().startsWith(r.toLowerCase()))
    if (!base) continue
    if (!byReason.has(base)) byReason.set(base, [])
    byReason.get(base).push({
      itemId: move.itemId || null,
      name: String(move.itemName || '').trim(),
      role: '',
      label: '',
      gross: toQty(Math.abs(Number(move.change) || 0)),
    })
  }

  const updates = []
  for (const job of need) {
    const base = String(job.reasonBase || '').trim()
    const components = (byReason.get(base) || []).filter((c) => c.name && c.gross > QTY_EPS)
    if (!components.length) continue
    job.inputComponents = components
    if (job._id) {
      updates.push(
        AlloyMixJob.updateOne(
          { _id: job._id },
          { $set: { inputComponents: components } },
          writeOpts(session),
        ).catch(() => null),
      )
    }
  }
  if (updates.length) await Promise.all(updates)
  return list
}

/**
 * Heal Vault Ops Metal IN when vault Add metal already bumped the job
 * but Ops / Production Dashboard still show the pre-add weight — or when the
 * mix is in vault with no open visit at all (prior visit already OUTed).
 */
async function syncOpenVaultOpsWeightFromJob(job, session = null) {
  if (!job || job.isDeleted) return false
  if (!(job.status === 'in_vault' && job.currentDepartment === VAULT)) return false
  const target = toQty(job.targetGross)
  if (!(target > QTY_EPS) || !job.mixCode) return false
  const purityJob = job.purity != null && Number.isFinite(Number(job.purity))
    ? Number(job.purity)
    : null
  const fineGold = job.fineGold != null && Number.isFinite(Number(job.fineGold))
    ? toQty(job.fineGold)
    : null
  const openVault = await findOpenAlloyOpsVisit({
    session,
    mixCode: job.mixCode,
    departmentKey: VAULT,
  })
  if (!openVault) {
    await upsertOpsRow({
      session,
      mixCode: job.mixCode,
      departmentKey: VAULT,
      date: dubaiDateKey(),
      batchNumber: job.mixCode,
      side: 'in',
      weight: target,
      purity: purityJob,
      fineGold,
      actor: { name: job.updatedByName || job.createdByName || '' },
      stamp: `vault-heal-${Date.now()}`,
      fromDepartment: 'update_mix',
    })
    return true
  }
  const currentIn = openVault.metalIn != null ? toQty(openVault.metalIn) : null
  if (currentIn != null && Math.abs(currentIn - target) <= 0.0005) return false

  openVault.metalIn = target
  if (fineGold != null) {
    openVault.fineGold = fineGold
  } else if (openVault.purity != null) {
    openVault.fineGold = toQty(target * (Number(openVault.purity) / 100))
  }
  if (purityJob != null) openVault.purity = purityJob
  if (openVault.metalOut == null) {
    openVault.metalLoss = null
  } else {
    openVault.metalLoss = Math.max(0, toQty(openVault.metalIn - openVault.metalOut))
  }
  await openVault.save(writeOpts(session))
  return true
}

async function serializeJobs(jobs, session = null) {
  const list = Array.isArray(jobs) ? jobs : []
  if (!list.length) return []
  await backfillInputComponents(list, session)
  // Repair Ops vault IN for mixes that already had vault Add metal applied.
  await Promise.all(
    list
      .filter((job) => job && job.status === 'in_vault' && job.currentDepartment === VAULT)
      .map((job) => syncOpenVaultOpsWeightFromJob(job, session).catch(() => false)),
  )
  const childrenByParent = await loadOpenChildrenByParent(session)
  return list.map((job) => serializeJob(job, { childrenByParent }))
}

async function serializeAllocateResult(result, session = null) {
  if (result?.partial && result.parent && result.child) {
    const childrenByParent = await loadOpenChildrenByParent(session)
    return {
      partial: true,
      pendingReceive: Boolean(result.pendingReceive),
      job: serializeJob(result.child, { childrenByParent }),
      parentJob: serializeJob(result.parent, { childrenByParent }),
      childJob: serializeJob(result.child, { childrenByParent }),
    }
  }
  return {
    partial: false,
    pendingReceive: result?.status === 'pending_receive',
    job: serializeJob(result),
  }
}

async function serializeReceiveResult(result, session = null) {
  return {
    decision: result?.decision || null,
    job: serializeJob(result?.job, {
      childrenByParent: await loadOpenChildrenByParent(session),
    }),
    metalInEntryId: result?.metalInEntry?.entryId || result?.metalInEntry?._id
      ? String(result.metalInEntry.entryId || result.metalInEntry._id)
      : null,
  }
}

/**
 * After FM approves Floor/Allocate Metal Out with OUT gross < mix target:
 * reverse + re-post as Updated Mix (AML → alloy_metal_loss / ~5500), reuse BMG code.
 * Call only once the job is back in vault.
 *
 * After + Add metal extras bumped targetGross, scale against Post Mix input sum
 * (not the bumped target) so the extras gap is not dumped onto the last metal.
 */
async function autoUpdateAlloyMixAfterMetalOut({
  user,
  batchLabel,
  outGross,
  tenant = 'mg',
  /** Floor department that booked Metal Out (melting / rolling / …). */
  lossDepartment = '',
} = {}) {
  const code = String(batchLabel || '').trim().toUpperCase()
  if (!isAlloyMixBatchCode(code)) return null
  const nextTarget = toQty(outGross)
  if (!(nextTarget > QTY_EPS)) return null

  const job = await AlloyMixJob.findOne({
    mixCode: code,
    isDeleted: { $ne: true },
    status: 'in_vault',
  })
  if (!job || !job.finishedProductId || !job.reasonBase) return null

  const priorTarget = toQty(job.targetGross)
  if (!(priorTarget > QTY_EPS)) return null

  const recipeSum = sumInputComponentGross(job.inputComponents)
  const purityPct = job.purity != null ? Number(job.purity) : null
  const plan = planMetalOutMixShrink({
    priorTarget,
    nextTarget,
    inputGrossSum: recipeSum,
    priorFineGold: job.fineGold,
    purityPct,
  })
  if (plan.action === 'none') return null

  // Extras-only: Out still covers the Post Mix recipe — shrink target/FG, keep inputs.
  if (plan.action === 'shrink_extras_only') {
    job.targetGross = plan.nextTarget
    if (plan.fineGold != null && plan.fineGold >= 0) {
      job.fineGold = plan.fineGold
    }
    job.updatedById = user?._id || job.updatedById
    job.updatedByName = user?.name || job.updatedByName || ''
    job.history.push({
      at: new Date(),
      action: 'update',
      fromDepartment: VAULT,
      toDepartment: VAULT,
      note: `Metal Out ${plan.nextTarget} g — extras shrink (recipe ${plan.scaleBase} g kept)`,
      actorId: user?._id || null,
      actorName: user?.name || '',
    })
    await job.save()
    if (job.stockLotId) {
      const lot = await ProductionStockLot.findById(job.stockLotId)
      if (lot) {
        lot.grossWeight = plan.nextTarget
        lot.netWeight = plan.nextTarget
        await lot.save()
      }
    }
    const openVault = await findOpenAlloyOpsVisit({
      session: null,
      mixCode: code,
      departmentKey: VAULT,
    })
    if (openVault) {
      openVault.metalIn = plan.nextTarget
      openVault.fineGold = plan.fineGold != null ? plan.fineGold : openVault.fineGold
      if (openVault.purity == null && purityPct != null) openVault.purity = purityPct
      await openVault.save()
    }
    return {
      success: true,
      extrasOnly: true,
      targetGross: plan.nextTarget,
      fineGold: plan.fineGold,
      reason: job.reasonBase,
      mixJob: serializeJob(job),
    }
  }

  const scaleBase = toQty(plan.scaleBase)
  const priorInputs = normalizeInputComponentsToTarget(job.inputComponents || [], scaleBase)
    .filter((row) => row.itemId && row.gross > QTY_EPS)
  if (!priorInputs.length) return null

  // This-step AML only — prior Update AML is preserved on account 5500.
  const lines = buildUpdatedMixRemainLines(priorInputs, {
    nextTarget: plan.nextTarget,
    scaleBase,
  })
  if (!lines.length) return null

  const InventoryItem = require('../../models/InventoryItem')
  const StockMovement = require('../../models/StockMovement')
  const Ledger = require('../../models/Ledger')
  const AccountMapping = require('../../models/AccountMapping')
  const Transaction = require('../../models/Transaction')
  const ChartOfAccount = require('../../models/ChartOfAccount')
  const { createAlloyMixService } = require('./alloyMixService')

  const svc = createAlloyMixService({
    InventoryItem,
    StockMovement,
    Ledger,
    AccountMapping,
    Transaction,
    ChartOfAccount,
  })

  const karat = Number(job.karat) || 18
  const tenantKey = String(tenant || user?.company || 'mg').trim().toLowerCase() || 'mg'
  await svc.reverseAlloyMix({
    user,
    tenant: tenantKey,
    reason: job.reasonBase,
    // Keep Melting AML; this call only adds the new Rolling (etc.) Metal Loss entry.
    preserveMetalLoss: true,
  })

  const description = `Gold alloy mix (${karat}K ${plan.nextTarget} g · updated)`
  const result = await svc.postAlloyMix({
    user,
    tenant: tenantKey,
    karat,
    targetGross: plan.nextTarget,
    finishedProductId: String(job.finishedProductId),
    lines,
    description,
    reuseMixCode: code,
    lossDepartment: lossDepartment || 'UPDATE',
  })

  // Stamp gold-only FG (scaled) — do not leave target × purity after extras history.
  if (result?.success && plan.fineGold != null && Number.isFinite(Number(plan.fineGold))) {
    const live = await AlloyMixJob.findOne({
      mixCode: code,
      isDeleted: { $ne: true },
      status: 'in_vault',
    })
    if (live) {
      live.fineGold = toQty(plan.fineGold)
      await live.save()
      if (result.mixJob) result.mixJob.fineGold = toQty(plan.fineGold)
    }
    const openVault = await findOpenAlloyOpsVisit({
      session: null,
      mixCode: code,
      departmentKey: VAULT,
    })
    if (openVault) {
      openVault.fineGold = toQty(plan.fineGold)
      await openVault.save()
    }
  }
  return result
}

/**
 * Scale recipe up or down so input remains match the vault bar weight before Add metal.
 * (normalizeInputComponentsToTarget only shrinks when sum > target.)
 */
function ensureComponentsMatchTarget(components = [], targetGross) {
  const target = toQty(targetGross)
  const list = (Array.isArray(components) ? components : [])
    .map((row) => {
      const gross = toQty(row?.gross)
      const consumeRaw = row?.consumeGross
      const consumeGross = consumeRaw === '' || consumeRaw == null
        ? null
        : toQty(consumeRaw)
      return {
        itemId: row?.itemId || null,
        name: String(row?.name || '').trim(),
        role: String(row?.role || '').trim(),
        label: String(row?.label || '').trim(),
        gross,
        consumeGross: consumeGross != null && consumeGross > QTY_EPS ? consumeGross : null,
      }
    })
    .filter((row) => row.name && row.gross > QTY_EPS)
  if (!(target > 0) || !list.length) return list
  const sum = toQty(list.reduce((acc, row) => acc + row.gross, 0))
  if (Math.abs(sum - target) <= 0.0005) return list
  if (sum > target + 0.0005) return normalizeInputComponentsToTarget(list, target)
  let allocated = 0
  return list.map((row, index) => {
    const isLast = index === list.length - 1
    const gross = isLast
      ? toQty(target - allocated)
      : toQty(row.gross * (target / sum))
    if (!isLast) allocated = toQty(allocated + gross)
    return { ...row, gross }
  }).filter((row) => row.gross > QTY_EPS)
}

/** Merge prior remains + addon into Update Mix lines (no AML this step). */
function mergeAddMetalUpdateLines(components = [], addon = {}) {
  const map = new Map()
  for (const row of Array.isArray(components) ? components : []) {
    const id = String(row?.itemId || '').trim()
    if (!id) continue
    const remain = toQty(row.gross)
    if (!(remain > QTY_EPS)) continue
    const prev = map.get(id)
    if (prev) {
      prev.gross = toQty(prev.gross + remain)
      prev.remainGross = prev.gross
    } else {
      map.set(id, {
        itemId: id,
        gross: remain,
        remainGross: remain,
        role: String(row.role || 'extra').trim().toLowerCase() || 'extra',
        label: String(row.label || row.name || '').trim(),
      })
    }
  }
  const addId = String(addon.itemId || '').trim()
  const addG = toQty(addon.gross)
  if (addId && addG > QTY_EPS) {
    const existing = map.get(addId)
    if (existing) {
      existing.gross = toQty(existing.gross + addG)
      existing.remainGross = existing.gross
    } else {
      map.set(addId, {
        itemId: addId,
        gross: addG,
        remainGross: addG,
        role: String(addon.role || 'extra').trim().toLowerCase() || 'extra',
        label: String(addon.label || addon.name || '').trim(),
      })
    }
  }
  return [...map.values()]
}

/** Nudge last line so sum(gross) === target (Add metal must not shrink the bar). */
function balanceUpdateLinesToTarget(lines = [], targetGross) {
  const list = Array.isArray(lines) ? lines : []
  const target = toQty(targetGross)
  if (!list.length || !(target > QTY_EPS)) return list
  const sum = toQty(list.reduce((acc, row) => acc + Number(row.gross || 0), 0))
  if (Math.abs(sum - target) <= 0.0005) return list
  const last = list[list.length - 1]
  const others = toQty(sum - Number(last.gross || 0))
  const nextLast = toQty(target - others)
  if (nextLast > QTY_EPS) {
    last.gross = nextLast
    last.remainGross = nextLast
  }
  return list
}

/**
 * Vault Room only: pick a catalog product, add gross (+ optional purity) onto an
 * in-vault mix — reverse + re-post as Updated Mix (addon in Inputs), bump Ops
 * vault Metal IN + breakdown, keep target = priorTarget + add (never shrink).
 *
 * Do not wrap in an outer Mongo session: reverse/post each own a transaction.
 */
async function addMetalToVaultMix({
  user,
  mixId,
  productId,
  gross,
  purity = null,
  note = '',
  session = null,
  tenant = 'mg',
} = {}) {
  const { catalogOnHandFromMovements } = require('../../utils/catalogOnHandQuantity')
  const InventoryItem = require('../../models/InventoryItem')
  const StockMovement = require('../../models/StockMovement')
  const Ledger = require('../../models/Ledger')
  const AccountMapping = require('../../models/AccountMapping')
  const Transaction = require('../../models/Transaction')
  const ChartOfAccount = require('../../models/ChartOfAccount')
  const { createAlloyMixService } = require('./alloyMixService')

  const addGross = toQty(gross)
  if (!(addGross > QTY_EPS)) throw httpError(400, 'Gross must be greater than zero')
  const itemId = String(productId || '').trim()
  if (!itemId) throw httpError(400, 'Select a stock product')

  // Prefer no outer session — reverse/post Alloy Mix run their own transactions.
  const job = await withSession(AlloyMixJob.findById(mixId), session)
  if (!job || job.isDeleted) throw httpError(404, 'Mix job not found')
  if (!(job.status === 'in_vault' && job.currentDepartment === VAULT)) {
    throw httpError(400, 'Add metal is only allowed while the mix is in Vault Room')
  }
  if (await hasOpenFloorDescendant(job._id, await loadOpenChildrenByParent(session))) {
    throw httpError(400, 'Cannot add metal while a split is still on the floor')
  }
  if (!job.finishedProductId || !job.reasonBase) {
    throw httpError(400, 'Mix job is missing finished product or reason — cannot Update Mix')
  }

  const item = await withSession(InventoryItem.findById(itemId), session)
  if (!item || item.isDeleted) throw httpError(404, 'Stock product not found')
  const productName = String(item.name || '').trim()
  if (!productName) throw httpError(400, 'Stock product has no name')
  if (/^alloy$/i.test(productName)) throw httpError(400, 'Cannot add finished Alloy as vault metal')

  const onHand = await catalogOnHandFromMovements(StockMovement, item._id)
  if (onHand + 1e-9 < addGross) {
    throw httpError(
      400,
      `Insufficient stock for ${productName}. Available: ${toQty(onHand)} g, requested: ${addGross} g.`,
    )
  }

  const category = String(item.category || '')
  const pairs = Object.fromEntries(
    category.split(';').map((part) => {
      const i = part.indexOf('=')
      if (i < 0) return [part.trim(), '']
      return [part.slice(0, i).trim(), part.slice(i + 1).trim()]
    }).filter(([k]) => k),
  )
  if (String(pairs.recordType || '').trim().toLowerCase() !== 'product') {
    throw httpError(400, 'Select a created inventory product (not a stock-type master)')
  }

  let purityPct = null
  const purityRaw = purity != null && purity !== ''
    ? Number(purity)
    : Number(pairs.productPurity || pairs.purity || item.purity || 0)
  if (Number.isFinite(purityRaw) && purityRaw > 0) {
    purityPct = purityRaw > 0 && purityRaw <= 1.2 ? purityRaw * 100 : purityRaw
  }

  const actorName = user?.name || ''
  const mixCode = String(job.mixCode || '').trim().toUpperCase()
  const priorTarget = toQty(job.targetGross)
  if (!(priorTarget > QTY_EPS)) throw httpError(400, 'Mix has no target gross')
  // Weight-safe: always prior + add — never postTarget = lineSum (that shrunk BMG).
  const nextTarget = toQty(priorTarget + addGross)
  const breakdownNote = `Add metal: ${productName} +${addGross} g`
  const addNote = String(note || '').trim()
    || `Vault add metal ${productName} +${addGross} g`
      + (purityPct != null ? ` @ ${purityPct}%` : '')

  const priorRecipe = sumInputComponentGross(job.inputComponents)
  let fineGold = job.fineGold != null && Number.isFinite(Number(job.fineGold))
    ? toQty(job.fineGold)
    : null
  if (fineGold == null) {
    const purityJob = job.purity != null ? Number(job.purity) : null
    if (purityJob != null && Number.isFinite(purityJob) && purityJob > 0) {
      const fgBase = priorRecipe > QTY_EPS && priorTarget > priorRecipe + 0.0005
        ? priorRecipe
        : priorTarget
      if (fgBase > QTY_EPS) fineGold = toQty((fgBase * purityJob) / 100)
    }
  }
  const metalKey = String(pairs.mainStock || pairs.metalType || productName).toLowerCase()
  const isGold = /gold|xau|\bau\b/.test(metalKey) || /gold|xau|\bau\b/.test(productName.toLowerCase())
  if (isGold && purityPct != null && purityPct > 0) {
    fineGold = toQty((fineGold != null ? fineGold : 0) + (addGross * (purityPct / 100)))
  }

  const matched = ensureComponentsMatchTarget(job.inputComponents || [], priorTarget)
  let lines = mergeAddMetalUpdateLines(matched, {
    itemId: item._id,
    name: productName,
    label: productName,
    gross: addGross,
    role: 'extra',
  })
  lines = balanceUpdateLinesToTarget(lines, nextTarget)
  if (!lines.length) throw httpError(400, 'No mix input lines to re-post after Add metal')

  const lineSum = toQty(lines.reduce((acc, row) => acc + Number(row.gross || 0), 0))
  if (Math.abs(lineSum - nextTarget) > 0.05) {
    throw httpError(
      400,
      `Add metal balance failed: inputs ${lineSum} g vs target ${nextTarget} g`,
    )
  }

  const svc = createAlloyMixService({
    InventoryItem,
    StockMovement,
    Ledger,
    AccountMapping,
    Transaction,
    ChartOfAccount,
  })
  const karat = Number(job.karat) || 18
  const tenantKey = String(tenant || user?.company || 'mg').trim().toLowerCase() || 'mg'
  const priorReason = String(job.reasonBase || '').trim()

  await svc.reverseAlloyMix({
    user,
    tenant: tenantKey,
    reason: priorReason,
    preserveMetalLoss: true,
  })

  const description = `Gold alloy mix (${karat}K ${nextTarget} g · updated)`
  const result = await svc.postAlloyMix({
    user,
    tenant: tenantKey,
    karat,
    targetGross: nextTarget,
    finishedProductId: String(job.finishedProductId),
    lines,
    description,
    reuseMixCode: mixCode,
    lossDepartment: 'vault',
  })
  if (!result?.success) {
    throw httpError(500, 'Add metal Update Mix post failed')
  }

  const live = await AlloyMixJob.findOne({
    mixCode,
    isDeleted: { $ne: true },
    status: 'in_vault',
  })
  if (live) {
    if (fineGold != null && Number.isFinite(Number(fineGold))) {
      live.fineGold = toQty(fineGold)
    }
    live.updatedById = user?._id || live.updatedById
    live.updatedByName = actorName || live.updatedByName || ''
    live.history = Array.isArray(live.history) ? live.history : []
    live.history.push({
      at: new Date(),
      action: 'update',
      fromDepartment: VAULT,
      toDepartment: VAULT,
      note: addNote,
      actorId: user?._id || null,
      actorName,
    })
    await live.save()
  }

  const openVault = await findOpenAlloyOpsVisit({
    session: null,
    mixCode,
    departmentKey: VAULT,
  })
  if (openVault) {
    openVault.metalIn = nextTarget
    if (fineGold != null && Number.isFinite(Number(fineGold))) {
      openVault.fineGold = toQty(fineGold)
    }
    if (openVault.metalOut == null) openVault.metalLoss = null
    else if (openVault.metalIn != null) {
      openVault.metalLoss = Math.max(0, toQty(openVault.metalIn - openVault.metalOut))
    }
    openVault.departmentManagerName = actorName || openVault.departmentManagerName || ''
    const prevNote = String(openVault.breakdown || '').trim()
    openVault.breakdown = prevNote && prevNote !== breakdownNote
      ? `${prevNote}; ${breakdownNote}`
      : breakdownNote
    const fromRaw = String(openVault.transferFromDepartment || '').trim().toLowerCase()
    if (!normalizeDept(fromRaw)) openVault.transferFromDepartment = 'update_mix'
    await openVault.save()
  }

  const jobDoc = live || (result.mixJob?.id
    ? await AlloyMixJob.findById(result.mixJob.id)
    : null)
  if (!jobDoc) {
    throw httpError(500, 'Add metal succeeded but mix job was not found')
  }
  return serializeJob(jobDoc, {
    childrenByParent: await loadOpenChildrenByParent(null),
  })
}

const WIP_LEDGER_ACCOUNT_CODE = '1205'
const STOCK_IN_HAND_ACCOUNT_CODE = '1200'
const FINISHED_JEWELRY_LEDGER_ACCOUNT_CODE = '1215'
const FINISHED_JEWELRY_LEDGER_ACCOUNT_NAME = 'Inventory - Finished Jewelry'

/**
 * Returns the shared Finished Jewelry stock account (code 1215), creating it
 * under Stock in Hand on first use. Idempotent: safe to call on every transfer.
 */
async function ensureFinishedJewelryLedgerAccount({ ChartOfAccount, user, session = null }) {
  const existing = await withSession(
    ChartOfAccount.findOne({ accountCode: FINISHED_JEWELRY_LEDGER_ACCOUNT_CODE }),
    session,
  )
  if (existing) return existing
  const parent = await withSession(
    ChartOfAccount.findOne({ accountCode: STOCK_IN_HAND_ACCOUNT_CODE }).select('_id currency').lean(),
    session,
  )
  const [created] = await ChartOfAccount.create(
    [
      {
        accountCode: FINISHED_JEWELRY_LEDGER_ACCOUNT_CODE,
        accountName: FINISHED_JEWELRY_LEDGER_ACCOUNT_NAME,
        accountType: 'Asset',
        parentAccountId: parent?._id || null,
        currency: parent?.currency || 'USD',
        description: 'Finished jewelry ready for sale (auto-created by Vault → Finished Jewelry transfer)',
        createdBy: user?._id || null,
      },
    ],
    writeOpts(session),
  )
  return created
}

/** Returns the WIP stock account (code 1205) if it exists, else null. */
async function findWipLedgerAccount({ ChartOfAccount, session = null }) {
  return withSession(
    ChartOfAccount.findOne({ accountCode: WIP_LEDGER_ACCOUNT_CODE }).select('_id').lean(),
    session,
  )
}

/**
 * Vault Room only: transfer full or partial weight of an in-vault alloy mix batch
 * into a Finished Jewelry InventoryItem (existing or created inline), posting
 * balanced StockMovements (OUT from WIP/alloy product, IN to Finished Jewelry),
 * updating/closing the open Vault Ops row & AlloyMixJob, and optionally posting
 * a balanced WIP → Finished Goods Ledger entry when both items have ledger accounts.
 */
async function transferVaultMixToFinishedJewelry({
  user,
  mixId,
  productId = '',
  newProduct = null,
  gross,
  pcs = 0,
  note = '',
  session = null,
} = {}) {
  const InventoryItem = require('../../models/InventoryItem')
  const StockMovement = require('../../models/StockMovement')
  const Ledger = require('../../models/Ledger')
  const ChartOfAccount = require('../../models/ChartOfAccount')

  const job = await withSession(AlloyMixJob.findById(mixId), session)
  if (!job || job.isDeleted) throw httpError(404, 'Mix job not found')
  if (!(job.status === 'in_vault' && job.currentDepartment === VAULT)) {
    throw httpError(400, 'Transfer to Finished Jewelry is only allowed while the mix is in Vault Room')
  }
  if (await hasOpenFloorDescendant(job._id, await loadOpenChildrenByParent(session))) {
    throw httpError(400, 'Cannot transfer to Finished Jewelry while a split is still on the floor')
  }

  const availableGross = toQty(job.targetGross)
  const transferGross = toQty(gross)
  if (!(transferGross > QTY_EPS)) {
    throw httpError(400, 'Transfer weight must be greater than zero')
  }
  if (transferGross > availableGross + QTY_EPS) {
    throw httpError(400, `Transfer weight (${transferGross} g) exceeds vault available (${availableGross} g)`)
  }
  const transferPcs = Math.max(0, Math.round(Number(pcs) || 0))
  const isFullTransfer = (availableGross - transferGross) <= QTY_EPS
  const remainingGross = isFullTransfer ? 0 : toQty(availableGross - transferGross)
  const now = new Date()
  const actorId = user?._id || null
  const actorName = String(user?.name || '').trim() || 'System'
  const cleanNote = String(note || '').trim().slice(0, 300)

  // 1. Resolve or create target Finished Jewelry InventoryItem
  let targetItem = null
  const targetId = String(productId || '').trim()
  if (targetId) {
    targetItem = await withSession(InventoryItem.findOne({ _id: targetId, isDeleted: { $ne: true } }), session)
    if (!targetItem) throw httpError(404, 'Selected finished jewelry product not found')
  } else if (newProduct && String(newProduct.name || '').trim()) {
    const prodName = String(newProduct.name).trim()
    const prodSku = String(newProduct.sku || '').trim()
    const prodCategory = String(newProduct.category || 'Finished Jewelry').trim()
    const escapedName = prodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const existingByName = await withSession(
      InventoryItem.findOne({
        name: { $regex: `^${escapedName}$`, $options: 'i' },
        isDeleted: { $ne: true },
      }),
      session,
    )
    if (existingByName) {
      targetItem = existingByName
    } else {
      const finishedAccount = await ensureFinishedJewelryLedgerAccount({ ChartOfAccount, user, session })
      const [created] = await InventoryItem.create(
        [
          {
            type: 'finished_good',
            name: prodName,
            sku: prodSku,
            category: prodCategory,
            unit: 'g',
            quantity: 0,
            pcs: 0,
            ledgerAccountId: finishedAccount._id,
            createdBy: actorId,
            updatedBy: actorId,
          },
        ],
        writeOpts(session),
      )
      targetItem = created
    }
  } else {
    throw httpError(400, 'Select a finished jewelry product or enter a new product name')
  }

  // 2. Deduct from source alloy/WIP InventoryItem (if linked and different from target)
  let sourceItem = null
  let transferValue = 0
  if (job.finishedProductId && String(job.finishedProductId) !== String(targetItem._id)) {
    sourceItem = await withSession(
      InventoryItem.findOne({ _id: job.finishedProductId, isDeleted: { $ne: true } }),
      session,
    )
  }
  const reasonBase = `Finished jewelry transfer · ${job.mixCode} → ${targetItem.name}${cleanNote ? ` · ${cleanNote}` : ''}`
  if (sourceItem) {
    const srcBefore = toQty(sourceItem.quantity || 0)
    const srcAfter = Math.max(0, toQty(srcBefore - transferGross))
    const unitCost = Number(sourceItem.unitCost || 0)
    transferValue = unitCost > 0 ? Number((unitCost * transferGross).toFixed(2)) : 0
    if (!sourceItem.ledgerAccountId && sourceItem.type === 'wip') {
      const wipAccount = await findWipLedgerAccount({ ChartOfAccount, session })
      if (wipAccount) sourceItem.ledgerAccountId = wipAccount._id
    }
    sourceItem.quantity = srcAfter
    sourceItem.updatedBy = actorId
    await sourceItem.save(writeOpts(session))
    await StockMovement.create(
      [
        {
          itemId: sourceItem._id,
          itemName: sourceItem.name,
          change: -transferGross,
          pcsChange: 0,
          quantityBefore: srcBefore,
          quantityAfter: srcAfter,
          valueDelta: -transferValue,
          carriesValue: transferValue > 0,
          reason: reasonBase,
          actorId,
          actorName,
        },
      ],
      writeOpts(session),
    )
  }

  // 3. Add to target Finished Jewelry InventoryItem
  const tgtBefore = toQty(targetItem.quantity || 0)
  const tgtAfter = toQty(tgtBefore + transferGross)
  targetItem.quantity = tgtAfter
  targetItem.pcs = Math.max(0, Number(targetItem.pcs || 0) + transferPcs)
  targetItem.lastRestockedAt = now
  if (transferValue > 0 && tgtAfter > 0) {
    const prevVal = Number(targetItem.unitCost || 0) * tgtBefore
    targetItem.unitCost = Number(((prevVal + transferValue) / tgtAfter).toFixed(4))
  }
  targetItem.updatedBy = actorId
  await targetItem.save(writeOpts(session))
  await StockMovement.create(
    [
      {
        itemId: targetItem._id,
        itemName: targetItem.name,
        change: transferGross,
        pcsChange: transferPcs,
        quantityBefore: tgtBefore,
        quantityAfter: tgtAfter,
        valueDelta: transferValue,
        carriesValue: transferValue > 0,
        reason: reasonBase,
        actorId,
        actorName,
      },
    ],
    writeOpts(session),
  )

  // 4. Optional balanced WIP → Finished Goods Ledger entry (when both items have distinct ledger accounts)
  let ledgerPosted = false
  let accountingWarning = ''
  const srcAcctId = sourceItem?.ledgerAccountId ? String(sourceItem.ledgerAccountId) : ''
  const tgtAcctId = targetItem?.ledgerAccountId ? String(targetItem.ledgerAccountId) : ''
  if (srcAcctId && tgtAcctId && srcAcctId !== tgtAcctId && transferValue > 0) {
    try {
      // Ledger is one row per double entry: debit the finished account, credit WIP.
      // Same shape and referenceType ('inventory') as the alloy mix inventory JV.
      await Ledger.create(
        [
          {
            date: now,
            debitAccountId: targetItem.ledgerAccountId,
            creditAccountId: sourceItem.ledgerAccountId,
            amount: transferValue,
            description: reasonBase,
            referenceType: 'inventory',
            referenceId: job._id,
            createdBy: actorId,
            updatedBy: actorId,
            department: user?.department || '',
            currency: 'USD',
            exchangeRate: 1,
          },
        ],
        writeOpts(session),
      )
      ledgerPosted = true
    } catch (err) {
      accountingWarning = `Ledger entry skipped: ${err?.message || err}`
    }
  } else {
    accountingWarning = 'Inventory & Operations updated (link Ledger Accounts on both products to auto-post WIP → Finished Goods JV).'
  }

  // 5. Update open Vault Room OperationsProductionEntry
  const code = String(job.mixCode || '').toUpperCase()
  const openVaultRow = await withSession(
    OperationsProductionEntry.findOne({
      alloyMixCode: code,
      departmentKey: VAULT,
      $or: [{ metalOut: null }, { metalOut: { $exists: false } }],
    }).sort({ createdAt: -1 }),
    session,
  )
  const noteLine = `Finished jewelry: ${targetItem.name} (${transferGross} g${transferPcs ? `, ${transferPcs} pcs` : ''})`
  if (openVaultRow) {
    const prevBreakdown = String(openVaultRow.breakdown || '').trim()
    openVaultRow.breakdown = prevBreakdown ? `${prevBreakdown} · ${noteLine}` : noteLine
    if (isFullTransfer) {
      openVaultRow.metalOut = openVaultRow.metalIn != null ? openVaultRow.metalIn : transferGross
      if (openVaultRow.purityOut == null && openVaultRow.purity != null) openVaultRow.purityOut = openVaultRow.purity
      if (openVaultRow.fineGoldOut == null && openVaultRow.fineGold != null) openVaultRow.fineGoldOut = openVaultRow.fineGold
      openVaultRow.metalLoss = 0
      openVaultRow.batchOverAt = now
      openVaultRow.transferToDepartment = 'finished_goods'
    } else {
      openVaultRow.metalIn = remainingGross
      if (openVaultRow.purity != null) {
        openVaultRow.fineGold = Number((remainingGross * (Number(openVaultRow.purity) / 100)).toFixed(4))
      }
    }
    await openVaultRow.save(writeOpts(session))
  }

  // 6. Update AlloyMixJob & ProductionStockLot
  job.targetGross = remainingGross
  if (isFullTransfer) {
    job.status = 'closed'
    job.currentDepartment = 'finished_goods'
  }
  job.history = Array.isArray(job.history) ? job.history : []
  job.history.push({
    action: 'transfer_finished',
    fromDepartment: VAULT,
    toDepartment: 'finished_goods',
    weightGrams: transferGross,
    note: noteLine,
    at: now,
    actorId,
    actorName,
  })
  await job.save(writeOpts(session))

  if (job.stockLotId) {
    const lot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
    if (lot) {
      const fromStatus = lot.status
      lot.grossWeight = remainingGross
      lot.netWeight = remainingGross
      if (isFullTransfer && lot.status !== 'FINISHED') {
        // 'CLOSED' is not a stock status; a fully transferred lot is now finished stock.
        lot.status = 'FINISHED'
      }
      await lot.save(writeOpts(session))
      if (isFullTransfer && fromStatus !== lot.status) {
        await ProductionStockStatusEvent.create(
          [
            {
              stockLotId: lot._id,
              stockCode: lot.stockCode,
              fromStatus,
              toStatus: lot.status,
              reason: `Finished jewelry transfer ${job.mixCode} → ${targetItem.name}`,
              actorId,
              actorName,
            },
          ],
          writeOpts(session),
        )
      }
    }
  }

  return {
    job: serializeJob(job, {
      childrenByParent: await loadOpenChildrenByParent(session),
    }),
    product: {
      id: String(targetItem._id),
      name: targetItem.name,
      sku: targetItem.sku || '',
      category: targetItem.category || '',
      quantity: targetItem.quantity,
      pcs: targetItem.pcs || 0,
    },
    transferGross,
    transferPcs,
    remainingGross,
    isFullTransfer,
    ledgerPosted,
    accountingWarning,
  }
}

module.exports = {
  VAULT,
  MIX_CODE_PREFIX,
  resolveAllocateFineGold,
  planMetalOutMixShrink,
  buildUpdatedMixRemainLines,
  createJobFromPostedMix,
  closeJobForReverse,
  assertJobUpdatableByReason,
  findOpenJobByReason,
  allocateMixJob,
  receiveMixJob,
  addMetalToVaultMix,
  transferVaultMixToFinishedJewelry,
  listMixJobs,
  serializeJob,
  serializeJobs,
  serializeAllocateResult,
  serializeReceiveResult,
  buildInputComponents,
  scaleInputComponents,
  normalizeInputComponentsToTarget,
  autoUpdateAlloyMixAfterMetalOut,
  jobInVaultCustody,
  hasOpenFloorDescendant,
  isAlloyMixBatchCode,
  dubaiDateKey,
  normalizeDept,
  mergeSplitAlloyOpsRows,
  PRODUCTION_DEPARTMENT_KEYS,
  QTY_EPS,
}
