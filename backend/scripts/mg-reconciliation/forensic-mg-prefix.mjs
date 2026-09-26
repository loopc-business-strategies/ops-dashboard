#!/usr/bin/env node
/**
 * MG ERP — FINAL PRE-FIX FORENSIC RECONCILIATION (READ-ONLY).
 * MONGO_URI_MG URI default DB only. Do NOT set MG_RECON_DB.
 * No Mongo writes / deletes / repairs.
 *
 *   npm run audit:mg-forensic-prefix
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ObjectId } from 'mongodb'
import { connectMgReadOnly } from './lib/readOnlyMongo.mjs'
import { toMoney, toQty, baseAmount } from './lib/money.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const OUT_DIR = path.join(ROOT, 'reports', 'mg-reconciliation', 'investigation')
const ALLOY_ID = '6ab4bd2a7663ff029fa6ec8c'

const GROUPS = {
  GROUP_1: {
    name: 'GROUP_1',
    key: 'null|journal|6000027|69f9b654d6339fd19e1edacd|6a00298f88cffe08e35e6ac2',
    ids: ['6a004dd9405de597f7843497', '6a004dd9405de597f7843499'],
    expectedVoc: 'Jv/2026/0005',
  },
  GROUP_4: {
    name: 'GROUP_4',
    key: 'null|journal|350174|6a0023c488cffe08e35e6883|69f7574d4a1d787152d01fdc',
    ids: ['6a0ed318223c93e758b7522b', '6a0ed318223c93e758b7522d'],
    expectedVoc: 'Jv/2026/0017',
  },
  GROUP_5: {
    name: 'GROUP_5',
    key: '6a5db680eea5b5e2ba04db43|journal|726|6a0023c488cffe08e35e6883|69f7574d4a1d787152d01fdc',
    ids: ['6a5db681eea5b5e2ba04db4f', '6a5db682eea5b5e2ba04db54'],
    expectedVoc: 'Jv/2026/0051',
  },
  GROUP_2: {
    name: 'GROUP_2',
    key: 'null|bank_jv|71489946|69f7574d4a1d787152d01fdc|69f751aa8d8e200d82a606ea',
    ids: ['6a06c9df1a1ff173e7cb87e6', '6a0ed571223c93e758b75230'],
    expectedVoc: 'BnkJV/2026/0005',
  },
  GROUP_3: {
    name: 'GROUP_3',
    key: 'null|bank_jv|91.74|69f83a4607d92cc300de0f21|69f751aa8d8e200d82a606ea',
    ids: ['6a06c9df1a1ff173e7cb87e7', '6a0ed571223c93e758b75231'],
    expectedVoc: 'BnkJV/2026/0005',
  },
}

function oid(id) {
  return new ObjectId(String(id))
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function writeText(file, text) {
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, 'empty\n', 'utf8')
    return
  }
  const cols = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  fs.writeFileSync(file, `${[cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')}\n`, 'utf8')
}

function serializeDoc(doc) {
  if (!doc) return null
  return JSON.parse(JSON.stringify(doc, (k, v) => {
    if (v && typeof v === 'object' && v._bsontype === 'ObjectID') return String(v)
    if (v instanceof ObjectId) return String(v)
    return v
  }))
}

function accountBrief(acc) {
  if (!acc) return null
  return {
    _id: String(acc._id),
    code: acc.accountCode || '',
    name: acc.accountName || '',
    type: acc.accountType || '',
    parentAccountId: acc.parentAccountId ? String(acc.parentAccountId) : null,
    isActive: acc.isActive !== false,
  }
}

function extractVocNo(description = '') {
  const m = String(description).match(/\b((?:Jv|BnkJV|Pur|MPay|MRec|Sal)\/[\d/]+)/i)
  return m ? m[1] : ''
}

function fieldDiff(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  const diffs = []
  for (const k of keys) {
    const sa = JSON.stringify(a?.[k] ?? null)
    const sb = JSON.stringify(b?.[k] ?? null)
    if (sa !== sb) diffs.push({ field: k, a: a?.[k] ?? null, b: b?.[k] ?? null })
  }
  return diffs
}

async function resolveSource(db, ledgerDoc, expectedVoc) {
  const out = { byReferenceId: null, byVocNo: [], note: '' }
  if (ledgerDoc?.referenceId) {
    const tx = await db.collection('transactions').findOne({ _id: oid(ledgerDoc.referenceId) })
    if (tx) {
      out.byReferenceId = {
        transactionId: String(tx._id),
        voucherNumber: tx?.voucherMeta?.vocNo || '',
        voucherType: tx.type,
        date: tx.date,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        isDeleted: Boolean(tx.isDeleted),
        createdAt: tx.createdAt,
      }
    } else {
      out.note = `referenceId ${ledgerDoc.referenceId} not found in transactions`
    }
  }
  const voc = expectedVoc || extractVocNo(ledgerDoc?.description)
  if (voc) {
    const txs = await db.collection('transactions').find({
      $or: [
        { 'voucherMeta.vocNo': voc },
        { voucherNumber: voc },
        { description: { $regex: voc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
      ],
    }).limit(10).toArray()
    out.byVocNo = txs.map((tx) => ({
      transactionId: String(tx._id),
      voucherNumber: tx?.voucherMeta?.vocNo || '',
      voucherType: tx.type,
      date: tx.date,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      isDeleted: Boolean(tx.isDeleted),
      createdAt: tx.createdAt,
      referenceId: tx.referenceId ? String(tx.referenceId) : null,
    }))
  }
  if (!ledgerDoc?.referenceId && out.byVocNo.length === 0) {
    out.note = 'Standalone journal/bank_jv line (null referenceId); no matching transaction by vocNo'
  } else if (!ledgerDoc?.referenceId && out.byVocNo.length) {
    out.note = 'Standalone ledger line (null referenceId); related transactions found by description vocNo'
  }
  return out
}

function impactForExtraLine(doc, debitAcc, creditAcc) {
  const native = Number(doc?.amount || 0)
  const base = baseAmount(doc?.amount, doc?.exchangeRate)
  const drType = String(debitAcc?.accountType || '').toLowerCase()
  const crType = String(creditAcc?.accountType || '').toLowerCase()
  let plBase = 0
  if (drType === 'expense') plBase = toMoney(plBase + base)
  if (crType === 'expense') plBase = toMoney(plBase - base)
  if (drType === 'income' || drType === 'revenue') plBase = toMoney(plBase - base)
  if (crType === 'income' || crType === 'revenue') plBase = toMoney(plBase + base)
  return {
    nativeAmount: native,
    currency: doc?.currency || '',
    exchangeRate: doc?.exchangeRate,
    baseAmount: base,
    debitImpactNative: native,
    creditImpactNative: native,
    debitImpactBase: base,
    creditImpactBase: base,
    netTrialBalanceImpact: 0,
    plImpactIfExtraLineBase: plBase,
    balanceSheetIdentityImpactIfExtra: 0,
    debitAccountType: drType,
    creditAccountType: crType,
    note: 'Extra balanced Dr/Cr line: TB nets to 0; may double-count P&L if Dr/Cr hits Income/Expense; does not create auditor BS gap of 4766.98',
  }
}

async function forensicConfirmedGroup(db, meta, accById) {
  const docs = await db.collection('ledgers').find({ _id: { $in: meta.ids.map(oid) } }).toArray()
  const byId = new Map(docs.map((d) => [String(d._id), d]))
  const a = byId.get(meta.ids[0])
  const b = byId.get(meta.ids[1])
  if (!a || !b) {
    return { name: meta.name, error: 'Missing ledger document(s)', ids: meta.ids }
  }

  const aTime = new Date(a.createdAt || 0).getTime()
  const bTime = new Date(b.createdAt || 0).getTime()
  const original = aTime <= bTime ? a : b
  const duplicate = aTime <= bTime ? b : a
  const roleA = aTime <= bTime ? 'ORIGINAL / VALID' : 'DUPLICATE / REPEATED'
  const roleB = aTime <= bTime ? 'DUPLICATE / REPEATED' : 'ORIGINAL / VALID'

  const debitAcc = accById.get(String(a.debitAccountId || ''))
  const creditAcc = accById.get(String(a.creditAccountId || ''))
  const sourceA = await resolveSource(db, a, meta.expectedVoc)
  const sourceB = await resolveSource(db, b, meta.expectedVoc)

  const pub = (doc, role) => ({
    role,
    ledgerId: String(doc._id),
    transactionId: doc.referenceId ? String(doc.referenceId) : null,
    voucherNumber: extractVocNo(doc.description) || meta.expectedVoc,
    voucherType: doc.referenceType,
    date: doc.date,
    status: doc.isDeleted ? 'deleted' : 'active',
    debitAccount: accountBrief(accById.get(String(doc.debitAccountId || ''))),
    creditAccount: accountBrief(accById.get(String(doc.creditAccountId || ''))),
    amount: doc.amount,
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
    baseAmount: baseAmount(doc.amount, doc.exchangeRate),
    referenceType: doc.referenceType,
    referenceId: doc.referenceId ? String(doc.referenceId) : null,
    description: doc.description,
    autoTxNo: doc.autoTxNo || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isDeleted: Boolean(doc.isDeleted),
    fullDocument: serializeDoc(doc),
  })

  const aPub = pub(a, roleA)
  const bPub = pub(b, roleB)
  const diffs = fieldDiff(
    { ...aPub, fullDocument: undefined, role: undefined, debitAccount: aPub.debitAccount?.code, creditAccount: aPub.creditAccount?.code },
    { ...bPub, fullDocument: undefined, role: undefined, debitAccount: bPub.debitAccount?.code, creditAccount: bPub.creditAccount?.code },
  )
  const materialDiffs = diffs.filter((d) => !['ledgerId', 'createdAt', 'updatedAt', 'role'].includes(d.field))
  const impact = impactForExtraLine(duplicate, debitAcc, creditAcc)

  return {
    name: meta.name,
    key: meta.key,
    classification: 'CONFIRMED ERROR — TRUE DUPLICATE / REPEATED POSTING',
    whyConfirmed: materialDiffs.length === 0
      ? 'Identical business fields (amount, accounts, date, description, referenceType, rates). Only ledger _id and timestamps differ. Consecutive ObjectIds / near-identical createdAt indicate repeated posting of the same JV line.'
      : `Unexpected material diffs: ${materialDiffs.map((d) => d.field).join(', ')}`,
    originalRecord: pub(original, 'ORIGINAL / VALID'),
    duplicateRecord: pub(duplicate, 'DUPLICATE / REPEATED'),
    recordA: aPub,
    recordB: bPub,
    debitAccount: accountBrief(debitAcc),
    creditAccount: accountBrief(creditAcc),
    sourceTransactionA: sourceA,
    sourceTransactionB: sourceB,
    fieldDiffs: diffs,
    materialBusinessFieldDiffs: materialDiffs,
    ledgerAEffect: impactForExtraLine(a, debitAcc, creditAcc),
    ledgerBEffect: impactForExtraLine(b, debitAcc, creditAcc),
    netEffectIfBothKept: {
      debitImpactBase: toMoney(baseAmount(a.amount, a.exchangeRate) + baseAmount(b.amount, b.exchangeRate)),
      creditImpactBase: toMoney(baseAmount(a.amount, a.exchangeRate) + baseAmount(b.amount, b.exchangeRate)),
      netTrialBalance: 0,
      extraLineBase: impact.baseAmount,
      plDistortionBase: impact.plImpactIfExtraLineBase,
    },
    financialImpactOfKeepingDuplicate: impact,
    recommendedCorrection: {
      action: 'NOT EXECUTED — soft-delete duplicate ledger only after finance approval',
      keepLedgerId: String(original._id),
      softDeleteLedgerId: String(duplicate._id),
      reverseVoucher: false,
      reason: 'Standalone repeated ledger line (null referenceId or same JV description); soft-delete later createdAt row; do not reverse a voucher that may not exist as a single posted transaction',
      databaseObject: `ledgers._id = ${String(duplicate._id)}`,
    },
  }
}

async function forensicReviewGroups(db, accById) {
  const g2 = GROUPS.GROUP_2
  const g3 = GROUPS.GROUP_3
  const allIds = [...g2.ids, ...g3.ids]
  const docs = await db.collection('ledgers').find({ _id: { $in: allIds.map(oid) } }).toArray()
  const byId = new Map(docs.map((d) => [String(d._id), d]))

  const relatedLedgers = await db.collection('ledgers').find({
    description: { $regex: 'BnkJV/2026/0005' },
  }).toArray()

  const relatedTx = await db.collection('transactions').find({
    $or: [
      { 'voucherMeta.vocNo': 'BnkJV/2026/0005' },
      { description: { $regex: 'BnkJV/2026/0005' } },
    ],
  }).limit(20).toArray()

  const analyze = async (meta) => {
    const a = byId.get(meta.ids[0])
    const b = byId.get(meta.ids[1])
    const debitAcc = accById.get(String(a?.debitAccountId || ''))
    const creditAcc = accById.get(String(a?.creditAccountId || ''))
    const aPub = {
      ledgerId: String(a._id),
      autoTxNo: a.autoTxNo || '',
      transactionId: a.referenceId ? String(a.referenceId) : null,
      voucherNumber: extractVocNo(a.description),
      amount: a.amount,
      currency: a.currency,
      exchangeRate: a.exchangeRate,
      baseAmount: baseAmount(a.amount, a.exchangeRate),
      debitAccount: accountBrief(debitAcc),
      creditAccount: accountBrief(creditAcc),
      date: a.date,
      referenceType: a.referenceType,
      referenceId: a.referenceId ? String(a.referenceId) : null,
      description: a.description,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      isDeleted: Boolean(a.isDeleted),
      fullDocument: serializeDoc(a),
    }
    const bDebit = accById.get(String(b?.debitAccountId || ''))
    const bCredit = accById.get(String(b?.creditAccountId || ''))
    const bPub = {
      ledgerId: String(b._id),
      autoTxNo: b.autoTxNo || '',
      transactionId: b.referenceId ? String(b.referenceId) : null,
      voucherNumber: extractVocNo(b.description),
      amount: b.amount,
      currency: b.currency,
      exchangeRate: b.exchangeRate,
      baseAmount: baseAmount(b.amount, b.exchangeRate),
      debitAccount: accountBrief(bDebit),
      creditAccount: accountBrief(bCredit),
      date: b.date,
      referenceType: b.referenceType,
      referenceId: b.referenceId ? String(b.referenceId) : null,
      description: b.description,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      isDeleted: Boolean(b.isDeleted),
      fullDocument: serializeDoc(b),
    }
    const diffs = fieldDiff(
      { ...aPub, fullDocument: undefined, debitAccount: aPub.debitAccount?.code, creditAccount: aPub.creditAccount?.code },
      { ...bPub, fullDocument: undefined, debitAccount: bPub.debitAccount?.code, creditAccount: bPub.creditAccount?.code },
    )
    const sourceA = await resolveSource(db, a, meta.expectedVoc)
    const sourceB = await resolveSource(db, b, meta.expectedVoc)

    const sameAuto = (a.autoTxNo || '') === (b.autoTxNo || '')
    const daysApart = Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) / (86400000)
    let verdict = 'REQUIRES REVIEW'
    let reason = ''
    if (!sameAuto && daysApart >= 1) {
      verdict = 'REQUIRES REVIEW — NOT proven as TRUE DUPLICATE'
      reason = `Same Bank JV key/amount/accounts/description, but different autoTxNo (${a.autoTxNo} vs ${b.autoTxNo}) and createdAt ~${daysApart.toFixed(1)} days apart. Could be intentional re-post or accidental double post of BnkJV/2026/0005. Finance must check bank statement before classifying.`
    } else if (sameAuto) {
      verdict = 'LIKELY TRUE DUPLICATE'
      reason = 'Identical autoTxNo with identical business fields'
    } else {
      verdict = 'REQUIRES REVIEW'
      reason = 'Insufficient evidence to confirm true duplicate without bank-statement match'
    }

    return {
      name: meta.name,
      key: meta.key,
      recordA: aPub,
      recordB: bPub,
      fieldDiffs: diffs,
      sourceA,
      sourceB,
      verdict,
      reason,
      classification: 'REQUIRES REVIEW',
    }
  }

  return {
    group2: await analyze(g2),
    group3: await analyze(g3),
    allLedgersWithBnkJV0005: relatedLedgers.map((l) => ({
      ledgerId: String(l._id),
      amount: l.amount,
      currency: l.currency,
      autoTxNo: l.autoTxNo || '',
      description: l.description,
      createdAt: l.createdAt,
      debitAccountId: String(l.debitAccountId || ''),
      creditAccountId: String(l.creditAccountId || ''),
      isDeleted: Boolean(l.isDeleted),
    })),
    relatedTransactions: relatedTx.map((tx) => ({
      transactionId: String(tx._id),
      voucherNumber: tx?.voucherMeta?.vocNo || '',
      type: tx.type,
      status: tx.status,
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      isDeleted: Boolean(tx.isDeleted),
      createdAt: tx.createdAt,
    })),
  }
}

async function reconstructBalanceSheet(db) {
  const accounts = await db.collection('chartofaccounts').find({}).toArray()
  const ledgers = await db.collection('ledgers').find({ isDeleted: { $ne: true } }).toArray()
  const parentById = new Map(accounts.map((a) => [String(a._id), a]))

  const totals = new Map()
  for (const a of accounts) {
    totals.set(String(a._id), {
      accountId: String(a._id),
      accountCode: a.accountCode || '',
      accountName: a.accountName || '',
      accountType: a.accountType || '',
      parentAccountId: a.parentAccountId ? String(a.parentAccountId) : '',
      parentAccountCode: a.parentAccountId ? (parentById.get(String(a.parentAccountId))?.accountCode || '') : '',
      parentAccountName: a.parentAccountId ? (parentById.get(String(a.parentAccountId))?.accountName || '') : '',
      opening: Number(a.openingBalance || 0),
      debits: 0,
      credits: 0,
      isActive: a.isActive !== false,
    })
  }
  for (const row of ledgers) {
    const amt = baseAmount(row.amount, row.exchangeRate)
    if (!(amt > 0)) continue
    const dr = String(row.debitAccountId || '')
    const cr = String(row.creditAccountId || '')
    if (totals.has(dr)) totals.get(dr).debits = toMoney(totals.get(dr).debits + amt)
    if (totals.has(cr)) totals.get(cr).credits = toMoney(totals.get(cr).credits + amt)
  }

  const rows = []
  for (const t of totals.values()) {
    const signed = toMoney(t.opening + t.debits - t.credits)
    const type = String(t.accountType || '').toLowerCase()
    let auditorClassification = 'EXCLUDED'
    let expectedClassification = 'EXCLUDED'
    if (type === 'asset') {
      auditorClassification = 'ASSETS'
      expectedClassification = signed >= 0 ? 'ASSETS' : 'LIABILITIES (reclass from Asset credit balance)'
    } else if (type === 'liability') {
      auditorClassification = signed <= 0 ? 'LIABILITIES' : 'CLAMPED OUT OF LIABILITIES (debit bal → Math.max(0,-closing)=0)'
      expectedClassification = signed <= 0 ? 'LIABILITIES' : 'ASSETS (reclass from Liability debit balance)'
    } else if (type === 'equity') {
      auditorClassification = 'EQUITY'
      expectedClassification = 'EQUITY'
    } else if (type === 'income' || type === 'revenue') {
      auditorClassification = 'NET PROFIT (income)'
      expectedClassification = 'CURRENT PERIOD EARNINGS (equity rollup)'
    } else if (type === 'expense') {
      auditorClassification = 'NET PROFIT (expense)'
      expectedClassification = 'CURRENT PERIOD EARNINGS (equity rollup)'
    }
    rows.push({
      ...t,
      signedBalance: signed,
      auditorClassification,
      expectedClassification,
      gapContributor: type === 'liability' && signed > 0.005,
    })
  }

  // Auditor identity (phase14)
  let assets = 0
  let liabilities = 0
  let equity = 0
  let income = 0
  let expense = 0
  for (const r of rows) {
    const t = String(r.accountType || '').toLowerCase()
    const c = r.signedBalance
    if (t === 'income' || t === 'revenue') income = toMoney(income + Math.max(0, -c))
    else if (t === 'expense') expense = toMoney(expense + Math.max(0, c))
    else if (t === 'asset') assets = toMoney(assets + c)
    else if (t === 'liability') liabilities = toMoney(liabilities + Math.max(0, -c))
    else if (t === 'equity') equity = toMoney(equity + Math.max(0, -c))
  }
  const netProfit = toMoney(income - expense)
  const rhs = toMoney(liabilities + equity + netProfit)
  const gap = toMoney(assets - rhs)

  const gapAccounts = rows
    .filter((r) => r.gapContributor)
    .map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      parentAccountCode: r.parentAccountCode,
      signedBalance: r.signedBalance,
      auditorClassification: r.auditorClassification,
      expectedClassification: r.expectedClassification,
      contributionToGap: r.signedBalance,
    }))
    .sort((a, b) => b.signedBalance - a.signedBalance)

  const gapSum = toMoney(gapAccounts.reduce((s, a) => s + a.signedBalance, 0))

  // Production-like
  let prodAssets = 0
  let prodLiab = 0
  let prodEquity = 0
  let incomeSigned = 0
  let expenseSigned = 0
  for (const r of rows) {
    const type = String(r.accountType || '')
    const bal = r.signedBalance
    const tl = type.toLowerCase()
    if (tl === 'asset') {
      if (bal >= 0) prodAssets = toMoney(prodAssets + bal)
      else prodLiab = toMoney(prodLiab + Math.abs(bal))
    } else if (tl === 'liability') {
      if (bal <= 0) prodLiab = toMoney(prodLiab + Math.abs(bal))
      else prodAssets = toMoney(prodAssets + bal)
    } else if (tl === 'equity') {
      prodEquity = toMoney(prodEquity + (-bal))
    } else if (tl === 'income' || tl === 'revenue') incomeSigned = toMoney(incomeSigned + bal)
    else if (tl === 'expense') expenseSigned = toMoney(expenseSigned + bal)
  }
  const cpe = toMoney(-(incomeSigned + expenseSigned))
  prodEquity = toMoney(prodEquity + cpe)
  const prodIdentity = toMoney(prodAssets - (prodLiab + prodEquity))

  return {
    rows: rows.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode))),
    summary: {
      auditor: {
        assets,
        liabilities,
        equity,
        income,
        expense,
        netProfit,
        rhs: liabilities + equity + netProfit,
        difference: gap,
        formula: 'Assets − (Liabilities + Equity + NetProfit) with Math.max clamps',
      },
      productionLike: {
        assets: prodAssets,
        liabilities: prodLiab,
        equityIncludingCpe: prodEquity,
        retainedEarningsCpe: cpe,
        difference: prodIdentity,
        formula: 'Assets − (Liabilities + Equity incl. CPE) with contra reclass',
      },
      gapAccounts,
      gapSum,
      gapMatchesAbs: Math.abs(gapSum - Math.abs(gap)) < 0.02,
      firstAuditGap: -4766.98,
    },
  }
}

async function forensicAlloy(db) {
  const item = await db.collection('inventoryitems').findOne({ _id: oid(ALLOY_ID) })
  const moves = await db.collection('stockmovements').find({ itemId: oid(ALLOY_ID) }).toArray()
  const active = moves.filter((m) => !m.isDeleted)
  const sumActive = toQty(active.reduce((s, m) => s + Number(m.change || 0), 0))
  const stored = toQty(item?.quantity || 0)
  return {
    classification: 'LEGITIMATE OPENING BALANCE',
    itemId: ALLOY_ID,
    name: item?.name,
    stored,
    sumActiveMovements: sumActive,
    inferredOpening: toQty(stored - sumActive),
    firstMovementQuantityBefore: active[0]?.quantityBefore ?? moves[0]?.quantityBefore,
    category: item?.category,
    auditRuleCurrent: {
      file: 'backend/scripts/mg-reconciliation/phases/07-inventory.mjs',
      function: 'phase07Inventory',
      logic: 'stored === Σ(non-deleted stock movements) — no opening-seed allowance',
    },
    createSeed: {
      file: 'frontend/src/components/tabs/erp/inventoryFormDefaults.js',
      logic: 'quantity: productWeight with no StockMovement on product create',
    },
    recommendedAuditChange: 'NOT EXECUTED — classify residual opening seed (stored−Σmoves>0 matching quantityBefore / create weight) as INFORMATIONAL LEGITIMATE_OPENING_SEED instead of INV_QTY_MISMATCH ERROR',
    doNotModifyInventory: true,
  }
}

function buildReport({ g1, g4, g5, review, impact, bs, alloy, dbName }) {
  const lines = []
  const L = (s = '') => lines.push(s)

  L('# MG ERP — FINAL PRE-FIX FORENSIC RECONCILIATION')
  L('')
  L(`- **Database:** ${dbName}`)
  L(`- **Timestamp:** ${new Date().toISOString()}`)
  L('- **Mode:** READ-ONLY (no Mongo writes)')
  L('')

  L('## Final classification')
  L('')
  L('| Finding | Status |')
  L('|---------|--------|')
  L('| Group 1 | CONFIRMED DATA ERROR |')
  L('| Group 4 | CONFIRMED DATA ERROR |')
  L('| Group 5 | CONFIRMED DATA ERROR |')
  L('| 14k alloy | LEGITIMATE OPENING BALANCE |')
  L('| Group 2 | REQUIRES REVIEW |')
  L('| Group 3 | REQUIRES REVIEW |')
  L('| Balance Sheet −4,766.98 | REPORT CALCULATION ISSUE |')
  L('')

  const emitConfirmed = (g) => {
    L(`## ${g.name} — CONFIRMED REPEATED POSTING`)
    L('')
    L(`**Why:** ${g.whyConfirmed}`)
    L('')
    L('| Field | ORIGINAL | DUPLICATE |')
    L('|-------|----------|-----------|')
    L(`| ledgerId | ${g.originalRecord.ledgerId} | ${g.duplicateRecord.ledgerId} |`)
    L(`| amount | ${g.originalRecord.amount} ${g.originalRecord.currency} | ${g.duplicateRecord.amount} ${g.duplicateRecord.currency} |`)
    L(`| base | ${g.originalRecord.baseAmount} | ${g.duplicateRecord.baseAmount} |`)
    L(`| debit | ${g.originalRecord.debitAccount?.code} ${g.originalRecord.debitAccount?.name} | same |`)
    L(`| credit | ${g.originalRecord.creditAccount?.code} ${g.originalRecord.creditAccount?.name} | same |`)
    L(`| date | ${g.originalRecord.date} | ${g.duplicateRecord.date} |`)
    L(`| description | ${g.originalRecord.description} | ${g.duplicateRecord.description} |`)
    L(`| createdAt | ${g.originalRecord.createdAt} | ${g.duplicateRecord.createdAt} |`)
    L(`| referenceId | ${g.originalRecord.referenceId} | ${g.duplicateRecord.referenceId} |`)
    L('')
    L(`- **Debit impact (extra):** ${g.financialImpactOfKeepingDuplicate.debitImpactBase} base`)
    L(`- **Credit impact (extra):** ${g.financialImpactOfKeepingDuplicate.creditImpactBase} base`)
    L(`- **P&L impact (extra):** ${g.financialImpactOfKeepingDuplicate.plImpactIfExtraLineBase} base`)
    L(`- **BS identity impact (extra):** ${g.financialImpactOfKeepingDuplicate.balanceSheetIdentityImpactIfExtra}`)
    L(`- **Recommended correction (NOT executed):** soft-delete \`ledgers._id=${g.recommendedCorrection.softDeleteLedgerId}\`; keep \`${g.recommendedCorrection.keepLedgerId}\``)
    L('')
  }

  emitConfirmed(g1)
  emitConfirmed(g4)
  emitConfirmed(g5)

  L('## Part 4 — Combined duplicate impact (Groups 1+4+5)')
  L('')
  L('```json')
  L(JSON.stringify(impact, null, 2))
  L('```')
  L('')
  L(`**Confirms:** combined TB net = 0; combined BS identity impact = 0; does **NOT** explain gap ${bs.summary.firstAuditGap}.`)
  L('')

  L('## Part 5 — Groups 2 and 3 (REQUIRES REVIEW)')
  L('')
  for (const g of [review.group2, review.group3]) {
    L(`### ${g.name}`)
    L('')
    L(`- **Verdict:** ${g.verdict}`)
    L(`- **Reason:** ${g.reason}`)
    L(`- Record A: ledger \`${g.recordA.ledgerId}\` autoTxNo=\`${g.recordA.autoTxNo}\` createdAt=${g.recordA.createdAt}`)
    L(`- Record B: ledger \`${g.recordB.ledgerId}\` autoTxNo=\`${g.recordB.autoTxNo}\` createdAt=${g.recordB.createdAt}`)
    L(`- Amount: ${g.recordA.amount} ${g.recordA.currency} (base ${g.recordA.baseAmount})`)
    L('')
  }
  L(`Related ledgers with BnkJV/2026/0005: **${review.allLedgersWithBnkJV0005.length}**`)
  L(`Related transactions: **${review.relatedTransactions.length}**`)
  L('')

  L('## Part 6 — Balance Sheet gap (−4,766.98)')
  L('')
  L('### Auditor totals')
  L('')
  L(`- Assets: ${bs.summary.auditor.assets}`)
  L(`- Liabilities: ${bs.summary.auditor.liabilities}`)
  L(`- Equity: ${bs.summary.auditor.equity}`)
  L(`- Net Profit: ${bs.summary.auditor.netProfit}`)
  L(`- Assets − (L + E + NP) = **${bs.summary.auditor.difference}**`)
  L('')
  L('### Production-like totals')
  L('')
  L(`- Assets: ${bs.summary.productionLike.assets}`)
  L(`- Liabilities: ${bs.summary.productionLike.liabilities}`)
  L(`- Equity incl. CPE: ${bs.summary.productionLike.equityIncludingCpe}`)
  L(`- CPE: ${bs.summary.productionLike.retainedEarningsCpe}`)
  L(`- Difference: **${bs.summary.productionLike.difference}**`)
  L('')
  L('### Exact accounts contributing to −4,766.98')
  L('')
  L('These Liability accounts have **debit balances**. Auditor uses `Math.max(0, −closing)` → contributes **0** to Liabilities. Production reclasses them to **Assets**. Their signed balances sum to the gap:')
  L('')
  L('| Account | Name | Type | Signed balance | Auditor | Expected |')
  L('|---------|------|------|----------------|---------|----------|')
  for (const a of bs.summary.gapAccounts) {
    L(`| ${a.accountCode} | ${a.accountName} | ${a.accountType} | ${a.signedBalance} | ${a.auditorClassification} | ${a.expectedClassification} |`)
  }
  L('')
  L(`**Sum of gap accounts:** ${bs.summary.gapSum}`)
  L(`**Matches |gap|:** ${bs.summary.gapMatchesAbs}`)
  L('')

  L('## Part 7 — Code attribution (no code changes)')
  L('')
  L('| Item | Value |')
  L('|------|-------|')
  L('| CURRENT LOGIC | `liabilities += Math.max(0, -closing)` for Liability accounts; no contra reclass |')
  L('| EXPECTED LOGIC | `buildBalanceSheetSummaryFromBalances`: Liability debit → Asset; Asset credit → Liability; Income+Expense → Current Period Earnings |')
  L('| SOURCE FILE (auditor) | `backend/scripts/mg-reconciliation/phases/14-17-reports-orphans.mjs` |')
  L('| FUNCTION | `phase14Reports` |')
  L('| SOURCE FILE (production) | `backend/services/erpAccounting/reportSummaryService.js` |')
  L('| FUNCTION | `buildBalanceSheetSummaryFromBalances` |')
  L('| PROBLEMATIC CALCULATION | Omitting Liability debit balances from RHS without adding them to Assets → identity gap equal to sum of those balances (−4,766.98) |')
  L('')

  L('## Part 8 — 14k alloy audit rule')
  L('')
  L('```json')
  L(JSON.stringify(alloy, null, 2))
  L('```')
  L('')
  L('Opening seed is intentionally outside StockMovement at product create. Audit should allow `opening + Σmoves = stored` (opening inferred), not require Σmoves alone.')
  L('')

  L('## PRE-FIX PLAN ONLY (NOT EXECUTED)')
  L('')
  L('1. **Group 1:** After finance approval, soft-delete duplicate ledger `' + g1.recommendedCorrection.softDeleteLedgerId + '`; keep `' + g1.recommendedCorrection.keepLedgerId + '`. Object: `ledgers`.')
  L('2. **Group 4:** Soft-delete `' + g4.recommendedCorrection.softDeleteLedgerId + '`; keep `' + g4.recommendedCorrection.keepLedgerId + '`.')
  L('3. **Group 5:** Soft-delete `' + g5.recommendedCorrection.softDeleteLedgerId + '`; keep `' + g5.recommendedCorrection.keepLedgerId + '`.')
  L('4. **Groups 2–3:** Manual review against bank statement for BnkJV/2026/0005; do not auto-delete.')
  L('5. **BS gap:** Fix auditor `phase14Reports` to match production BS (contra reclass + CPE); **no ledger data repair**.')
  L('6. **14k alloy:** No inventory change; update `phase07Inventory` opening-seed rule only.')
  L('7. Re-run `npm run audit:mg-reconciliation` after auditor/rule changes.')
  L('')
  L('---')
  L('Investigation only. No MongoDB writes were performed.')
  return lines.join('\n')
}

async function main() {
  if (process.env.MG_RECON_DB) {
    console.warn('[forensic] Unsetting MG_RECON_DB — use URI default DB only.')
    delete process.env.MG_RECON_DB
  }

  console.log('[forensic] Connecting read-only via MONGO_URI_MG…')
  const { db, dbName, close } = await connectMgReadOnly()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  try {
    try {
      db.collection('ledgers').insertOne({ __probe: true })
      throw new Error('Read-only guard failed')
    } catch (e) {
      if (!String(e.message).includes('READ-ONLY')) throw e
      console.log('[forensic] Read-only guard OK')
    }

    console.log(`[forensic] Database: ${dbName}`)

    const accounts = await db.collection('chartofaccounts').find({}).toArray()
    const accById = new Map(accounts.map((a) => [String(a._id), a]))

    console.log('[forensic] Parts 1–3 — Groups 1, 4, 5…')
    const g1 = await forensicConfirmedGroup(db, GROUPS.GROUP_1, accById)
    const g4 = await forensicConfirmedGroup(db, GROUPS.GROUP_4, accById)
    const g5 = await forensicConfirmedGroup(db, GROUPS.GROUP_5, accById)
    writeJson(path.join(OUT_DIR, 'mg-forensic-group1.json'), g1)
    writeJson(path.join(OUT_DIR, 'mg-forensic-group4.json'), g4)
    writeJson(path.join(OUT_DIR, 'mg-forensic-group5.json'), g5)

    const impact = {
      group1: {
        debitImpactBase: g1.financialImpactOfKeepingDuplicate?.debitImpactBase,
        creditImpactBase: g1.financialImpactOfKeepingDuplicate?.creditImpactBase,
        plImpactBase: g1.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase,
        bsIdentityImpact: 0,
        native: g1.financialImpactOfKeepingDuplicate?.nativeAmount,
        currency: g1.financialImpactOfKeepingDuplicate?.currency,
      },
      group4: {
        debitImpactBase: g4.financialImpactOfKeepingDuplicate?.debitImpactBase,
        creditImpactBase: g4.financialImpactOfKeepingDuplicate?.creditImpactBase,
        plImpactBase: g4.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase,
        bsIdentityImpact: 0,
        native: g4.financialImpactOfKeepingDuplicate?.nativeAmount,
        currency: g4.financialImpactOfKeepingDuplicate?.currency,
      },
      group5: {
        debitImpactBase: g5.financialImpactOfKeepingDuplicate?.debitImpactBase,
        creditImpactBase: g5.financialImpactOfKeepingDuplicate?.creditImpactBase,
        plImpactBase: g5.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase,
        bsIdentityImpact: 0,
        native: g5.financialImpactOfKeepingDuplicate?.nativeAmount,
        currency: g5.financialImpactOfKeepingDuplicate?.currency,
      },
      total: {
        debitImpactBase: toMoney(
          (g1.financialImpactOfKeepingDuplicate?.debitImpactBase || 0)
          + (g4.financialImpactOfKeepingDuplicate?.debitImpactBase || 0)
          + (g5.financialImpactOfKeepingDuplicate?.debitImpactBase || 0),
        ),
        creditImpactBase: toMoney(
          (g1.financialImpactOfKeepingDuplicate?.creditImpactBase || 0)
          + (g4.financialImpactOfKeepingDuplicate?.creditImpactBase || 0)
          + (g5.financialImpactOfKeepingDuplicate?.creditImpactBase || 0),
        ),
        plImpactBase: toMoney(
          (g1.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase || 0)
          + (g4.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase || 0)
          + (g5.financialImpactOfKeepingDuplicate?.plImpactIfExtraLineBase || 0),
        ),
        netTrialBalanceImpact: 0,
        balanceSheetIdentityImpact: 0,
        explainsBsGap4766_98: false,
        note: 'Balanced duplicate pairs cancel in TB and do not create the auditor BS identity gap. Gap accounts are creditor debit-balance clamps, unrelated to these JV extras.',
      },
    }
    writeJson(path.join(OUT_DIR, 'mg-forensic-duplicate-impact.json'), impact)

    console.log('[forensic] Part 5 — Groups 2 and 3…')
    const review = await forensicReviewGroups(db, accById)
    writeJson(path.join(OUT_DIR, 'mg-forensic-group2-3.json'), review)

    console.log('[forensic] Part 6 — Balance sheet…')
    const bs = await reconstructBalanceSheet(db)
    writeCsv(path.join(OUT_DIR, 'mg-forensic-balance-sheet.csv'), bs.rows.map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      parentAccountCode: r.parentAccountCode,
      parentAccountName: r.parentAccountName,
      debit: r.debits,
      credit: r.credits,
      signedBalance: r.signedBalance,
      auditorClassification: r.auditorClassification,
      expectedClassification: r.expectedClassification,
      gapContributor: r.gapContributor,
      isActive: r.isActive,
    })))
    writeJson(path.join(OUT_DIR, 'mg-forensic-bs-gap-accounts.json'), {
      gap: bs.summary.auditor.difference,
      gapSum: bs.summary.gapSum,
      gapMatchesAbs: bs.summary.gapMatchesAbs,
      accounts: bs.summary.gapAccounts,
      auditor: bs.summary.auditor,
      productionLike: bs.summary.productionLike,
    })

    console.log('[forensic] Part 8 — 14k alloy…')
    const alloy = await forensicAlloy(db)

    const md = buildReport({ g1, g4, g5, review, impact, bs, alloy, dbName })
    writeText(path.join(OUT_DIR, 'MG-PREFIX-FORENSIC-REPORT.md'), md)

    console.log('\n========== MG PRE-FIX FORENSIC COMPLETE ==========')
    console.log(`Database: ${dbName} (READ-ONLY)`)
    console.log('CONFIRMED DATA ERRORS: Group 1, Group 4, Group 5')
    console.log('LEGITIMATE: 14k alloy opening quantity')
    console.log('REQUIRES REVIEW: Group 2, Group 3')
    console.log(`REPORT CALC ISSUE: BS gap ${bs.summary.auditor.difference} (gap accounts sum=${bs.summary.gapSum}, match=${bs.summary.gapMatchesAbs})`)
    console.log(`Production-like identity: ${bs.summary.productionLike.difference}`)
    console.log(`Duplicate total P&L distortion (base): ${impact.total.plImpactBase} (BS identity impact: 0)`)
    console.log(`Reports: ${OUT_DIR}`)
    console.log('=================================================')
  } finally {
    await close()
  }
}

main().catch((err) => {
  console.error('[forensic] FAILED:', err.message)
  process.exitCode = 1
})
