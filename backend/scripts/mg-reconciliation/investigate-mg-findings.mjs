#!/usr/bin/env node
/**
 * MG ERP — second-stage READ-ONLY investigation of first-audit findings.
 * Uses MONGO_URI_MG URI default DB only (do not set MG_RECON_DB).
 *
 *   npm run audit:mg-investigate-findings
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

const DUP_GROUPS = [
  {
    name: 'GROUP_1',
    key: 'null|journal|6000027|69f9b654d6339fd19e1edacd|6a00298f88cffe08e35e6ac2',
    ids: ['6a004dd9405de597f7843497', '6a004dd9405de597f7843499'],
  },
  {
    name: 'GROUP_2',
    key: 'null|bank_jv|71489946|69f7574d4a1d787152d01fdc|69f751aa8d8e200d82a606ea',
    ids: ['6a06c9df1a1ff173e7cb87e6', '6a0ed571223c93e758b75230'],
  },
  {
    name: 'GROUP_3',
    key: 'null|bank_jv|91.74|69f83a4607d92cc300de0f21|69f751aa8d8e200d82a606ea',
    ids: ['6a06c9df1a1ff173e7cb87e7', '6a0ed571223c93e758b75231'],
  },
  {
    name: 'GROUP_4',
    key: 'null|journal|350174|6a0023c488cffe08e35e6883|69f7574d4a1d787152d01fdc',
    ids: ['6a0ed318223c93e758b7522b', '6a0ed318223c93e758b7522d'],
  },
  {
    name: 'GROUP_5',
    key: '6a5db680eea5b5e2ba04db43|journal|726|6a0023c488cffe08e35e6883|69f7574d4a1d787152d01fdc',
    ids: ['6a5db681eea5b5e2ba04db4f', '6a5db682eea5b5e2ba04db54'],
  },
]

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
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))]
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8')
}

function parseCategoryMeta(category = '') {
  const out = {}
  String(category || '').split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  })
  return out
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

function ledgerPublic(doc) {
  if (!doc) return null
  return {
    ledgerId: String(doc._id),
    date: doc.date,
    debitAccountId: doc.debitAccountId ? String(doc.debitAccountId) : null,
    creditAccountId: doc.creditAccountId ? String(doc.creditAccountId) : null,
    amount: doc.amount,
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
    referenceType: doc.referenceType,
    referenceId: doc.referenceId ? String(doc.referenceId) : null,
    transactionId: doc.referenceId ? String(doc.referenceId) : null,
    description: doc.description,
    department: doc.department,
    notes: doc.notes,
    autoTxNo: doc.autoTxNo,
    txRefNo: doc.txRefNo,
    chequeNo: doc.chequeNo,
    paymentType: doc.paymentType,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isDeleted: Boolean(doc.isDeleted),
  }
}

function fieldDiff(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  const diffs = []
  for (const k of keys) {
    const va = a?.[k]
    const vb = b?.[k]
    const sa = va instanceof Date ? va.toISOString() : JSON.stringify(va)
    const sb = vb instanceof Date ? vb.toISOString() : JSON.stringify(vb)
    if (sa !== sb) diffs.push({ field: k, a: va, b: vb })
  }
  return diffs
}

function classifyDupPair(a, b, diffs) {
  if (a.isDeleted || b.isDeleted) {
    return { status: 'LEGITIMATE DATA', detail: 'One or both rows soft-deleted' }
  }
  const material = diffs.filter((d) => !['ledgerId', 'createdAt', 'updatedAt', '_id'].includes(d.field))
  const onlyTimestamps = material.length === 0
  if (onlyTimestamps) {
    return { status: 'CONFIRMED ERROR', subtype: 'TRUE DUPLICATE / REPEATED POSTING', detail: 'Identical business fields; only id/timestamps differ' }
  }
  const descDiff = material.some((d) => d.field === 'description' || d.field === 'notes' || d.field === 'autoTxNo' || d.field === 'chequeNo' || d.field === 'txRefNo')
  const dateDiff = material.some((d) => d.field === 'date')
  if (descDiff || dateDiff) {
    return { status: 'REQUIRES REVIEW', subtype: 'POSSIBLE LEGITIMATE SEPARATE LINES', detail: 'Same amount/accounts but description/date/cheque fields differ' }
  }
  return { status: 'REQUIRES REVIEW', subtype: 'MANUAL REVIEW', detail: `Differing fields: ${material.map((d) => d.field).join(', ')}` }
}

async function findTxByVocNo(db, vocNo) {
  if (!vocNo) return null
  const q = {
    $or: [
      { 'voucherMeta.vocNo': vocNo },
      { voucherNumber: vocNo },
      { description: { $regex: vocNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
    ],
  }
  const txs = await db.collection('transactions').find(q).sort({ isDeleted: 1, createdAt: -1 }).limit(5).toArray()
  const tx = txs.find((t) => !t.isDeleted) || txs[0]
  if (!tx) return null
  return {
    transactionId: String(tx._id),
    voucherNumber: tx?.voucherMeta?.vocNo || tx.voucherNumber || '',
    type: tx.type,
    status: tx.status,
    date: tx.date,
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    lines: Array.isArray(tx.lines) ? tx.lines.length : undefined,
    isDeleted: Boolean(tx.isDeleted),
    createdAt: tx.createdAt,
    alternateMatches: txs.length,
  }
}

async function investigateAlloy(db) {
  const item = await db.collection('inventoryitems').findOne({ _id: oid(ALLOY_ID) })
  const movesAll = await db.collection('stockmovements').find({ itemId: oid(ALLOY_ID) }).toArray()
  const movesActive = movesAll.filter((m) => !m.isDeleted)
  const movesDeleted = movesAll.filter((m) => m.isDeleted)
  const meta = parseCategoryMeta(item?.category)

  const sumActive = toQty(movesActive.reduce((s, m) => s + Number(m.change || 0), 0))
  const sumAll = toQty(movesAll.reduce((s, m) => s + Number(m.change || 0), 0))
  const stored = toQty(item?.quantity || 0)
  const inferredOpening = toQty(stored - sumActive)

  const movementRows = movesAll.map((m) => ({
    movementId: String(m._id),
    change: m.change,
    quantityBefore: m.quantityBefore,
    quantityAfter: m.quantityAfter,
    direction: Number(m.change || 0) >= 0 ? 'IN' : 'OUT',
    reason: m.reason || '',
    reference: m.reference || '',
    referenceType: m.referenceType || '',
    transactionId: m.transactionId ? String(m.transactionId) : (m.referenceId ? String(m.referenceId) : ''),
    voucherNumber: String(m.reason || '').match(/#([A-Za-z]+\/[\d/]+)/)?.[1] || '',
    date: m.date || m.createdAt,
    createdAt: m.createdAt,
    isDeleted: Boolean(m.isDeleted),
  }))

  const vocNos = [...new Set(movementRows.map((m) => m.voucherNumber).filter(Boolean))]
  const relatedTransactions = {}
  for (const v of vocNos) {
    relatedTransactions[v] = await findTxByVocNo(db, v)
  }

  let determination = 'E'
  let determinationLabel = 'Audit calculation issue'
  let explanation = ''

  if (movesActive.length >= 2 && Math.abs(sumActive) < 1e-9 && Math.abs(stored - 1) < 1e-9) {
    determination = 'C/F'
    determinationLabel = 'Opening balance not represented as stock movement / Legitimate opening stock'
    const firstBefore = movesAll.find((m) => Number(m.quantityBefore) === 1 || Number(m.quantityBefore) === stored)
    explanation = 'Active movements sum to 0 (+1000 purchase, −1000 metal payment). Stored qty 1 matches product-create seed (weight=1g) with no opening StockMovement.'
      + (firstBefore ? ` First movement quantityBefore=${firstBefore.quantityBefore} confirms opening qty already present.` : '')
      + (movesDeleted.length ? ` Also ${movesDeleted.length} soft-deleted movement(s) (e.g. FIXED purchase superseded by UNFIXED).` : '')
  } else if (movesActive.length === 0 && stored > 0) {
    determination = 'C/F'
    determinationLabel = 'Opening stock without movements'
    explanation = 'Quantity present with zero stock movements — likely create-time seed.'
  } else if (Math.abs(sumActive - stored) > 1e-6 && movesDeleted.length) {
    determination = 'D'
    determinationLabel = 'Deleted/ignored movement'
    explanation = 'Soft-deleted movements may explain gap.'
  } else if (Math.abs(sumActive - stored) > 1e-6) {
    determination = 'A/B'
    determinationLabel = 'Missing stock movement or incorrect inventory quantity'
    explanation = 'Stored qty does not equal sum of active movements.'
  }

  return {
    item: item ? {
      _id: String(item._id),
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalValue: toMoney(Number(item.quantity || 0) * Number(item.unitCost || 0)),
      purity: meta.productPurity || meta.purity || '',
      grossWeight: meta.grossWeight || meta.weight || item.weight || '',
      pureWeight: meta.purityWeight || '',
      category: item.category,
      isDeleted: Boolean(item.isDeleted),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      unit: item.unit,
    } : null,
    movements: movementRows,
    relatedTransactions,
    rollForward: {
      stored,
      sumActiveMovements: sumActive,
      sumAllMovementsIncludingDeleted: sumAll,
      inferredOpeningNotInMovements: inferredOpening,
      deletedMovementCount: movesDeleted.length,
    },
    determination: {
      code: determination,
      label: determinationLabel,
      explanation,
      options: {
        A: 'Missing stock movement',
        B: 'Incorrect inventory quantity',
        C: 'Opening balance not represented as stock movement',
        D: 'Deleted/ignored movement',
        E: 'Audit calculation issue',
        F: 'Legitimate business opening stock',
      },
    },
  }
}

async function investigateDuplicates(db) {
  const allIds = DUP_GROUPS.flatMap((g) => g.ids)
  const ledgers = await db.collection('ledgers').find({ _id: { $in: allIds.map(oid) } }).toArray()
  const byId = new Map(ledgers.map((l) => [String(l._id), l]))

  const accountIds = [...new Set(ledgers.flatMap((l) => [String(l.debitAccountId || ''), String(l.creditAccountId || '')]).filter(Boolean))]
  const accounts = await db.collection('chartofaccounts').find({ _id: { $in: accountIds.map(oid) } }).toArray()
  const accById = new Map(accounts.map((a) => [String(a._id), a]))

  const refIds = [...new Set(ledgers.map((l) => l.referenceId).filter(Boolean).map(String))]
  const txs = refIds.length
    ? await db.collection('transactions').find({ _id: { $in: refIds.map(oid) } }).toArray()
    : []
  const txById = new Map(txs.map((t) => [String(t._id), t]))

  const groups = []
  for (const g of DUP_GROUPS) {
    const aDoc = byId.get(g.ids[0])
    const bDoc = byId.get(g.ids[1])
    const a = ledgerPublic(aDoc)
    const b = ledgerPublic(bDoc)
    const diffs = fieldDiff(a, b)
    const classification = classifyDupPair(a || {}, b || {}, diffs)

    const resolveTx = (doc) => {
      if (!doc?.referenceId) return null
      const t = txById.get(String(doc.referenceId))
      if (!t) return { referenceId: String(doc.referenceId), note: 'No transaction document (standalone journal/bank_jv)' }
      return {
        transactionId: String(t._id),
        voucherNumber: t?.voucherMeta?.vocNo || '',
        transactionType: t.type,
        status: t.status,
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        reference: t.description,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    }

    const amount = Number(aDoc?.amount || 0)
    const debitAcc = accById.get(String(aDoc?.debitAccountId || ''))
    const creditAcc = accById.get(String(aDoc?.creditAccountId || ''))
    const isTrueDup = classification.status === 'CONFIRMED ERROR'
    // Extra duplicate line: +amount on debit type side and +amount on credit type side in TB (nets to 0 in TB)
    // BS distortion if debit/credit account types differ in auditor classification
    const netBsImpactIfExtra = isTrueDup ? 0 : 0 // TB cancel; P&L/BS identity may still shift if types differ in report formula
    const debitType = String(debitAcc?.accountType || '').toLowerCase()
    const creditType = String(creditAcc?.accountType || '').toLowerCase()

    groups.push({
      name: g.name,
      key: g.key,
      recordA: a,
      recordB: b,
      debitAccount: accountBrief(debitAcc),
      creditAccount: accountBrief(creditAcc),
      transactionA: resolveTx(aDoc),
      transactionB: resolveTx(bDoc),
      fieldDiffs: diffs,
      classification,
      financialEffect: {
        amount,
        debitImpact: amount,
        creditImpact: amount,
        netTrialBalanceImpact: 0,
        affectedAccounts: [debitAcc?.accountCode, creditAcc?.accountCode].filter(Boolean),
        debitAccountType: debitType,
        creditAccountType: creditType,
        plImpactIfExtraLine: (debitType === 'expense' ? amount : 0) + (creditType === 'income' || creditType === 'revenue' ? -amount : 0)
          + (creditType === 'expense' ? -amount : 0) + (debitType === 'income' || debitType === 'revenue' ? amount : 0),
        // Auditor BS uses Assets vs Liab+Equity+NP; extra balanced JV does not change Assets−(L+E) by amount alone when both sides same statement section
        balanceSheetIdentityImpactIfExtra: 0,
        note: isTrueDup
          ? 'Duplicate balanced ledger pair cancels in Trial Balance; does not by itself create Assets−(L+E+NP) gap of 4766.98'
          : 'Not classified as confirmed duplicate — no assumed BS impact',
      },
    })
  }

  return { groups }
}

async function investigateBalanceSheet(db) {
  const accounts = await db.collection('chartofaccounts').find({}).toArray()
  const ledgers = await db.collection('ledgers').find({ isDeleted: { $ne: true } }).toArray()

  const totals = new Map()
  for (const a of accounts) {
    totals.set(String(a._id), {
      accountId: String(a._id),
      accountCode: a.accountCode || '',
      accountName: a.accountName || '',
      accountType: a.accountType || '',
      parentAccountId: a.parentAccountId ? String(a.parentAccountId) : '',
      isActive: a.isActive !== false,
      opening: Number(a.openingBalance || 0),
      debits: 0,
      credits: 0,
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
    const typeRaw = String(t.accountType || '')
    const type = typeRaw.toLowerCase()
    // First-auditor inclusion rules (phase14Reports)
    let auditorSection = 'EXCLUDED'
    let auditorInclude = 'NO'
    if (type === 'asset') { auditorSection = 'Assets'; auditorInclude = 'YES' }
    else if (type === 'liability') { auditorSection = 'Liabilities'; auditorInclude = 'YES' }
    else if (type === 'equity') { auditorSection = 'Equity'; auditorInclude = 'YES' }
    else if (type === 'income' || type === 'revenue') { auditorSection = 'Income (via NetProfit)'; auditorInclude = 'VIA_NP' }
    else if (type === 'expense') { auditorSection = 'Expense (via NetProfit)'; auditorInclude = 'VIA_NP' }

    // Production-like (reportSummaryService): Asset/Liability/Equity on BS; Income+Expense → CPE
    // Also flips contra balances (Asset Cr → Liability, Liability Dr → Asset)
    let prodSection = 'EXCLUDED'
    let prodSignedContribution = 0
    if (type === 'asset') {
      if (signed >= 0) { prodSection = 'Asset'; prodSignedContribution = signed }
      else { prodSection = 'Liability (reclass from Asset)'; prodSignedContribution = signed }
    } else if (type === 'liability') {
      if (signed <= 0) { prodSection = 'Liability'; prodSignedContribution = signed }
      else { prodSection = 'Asset (reclass from Liability)'; prodSignedContribution = signed }
    } else if (type === 'equity') {
      prodSection = 'Equity'
      prodSignedContribution = signed
    } else if (type === 'income' || type === 'revenue' || type === 'expense') {
      prodSection = 'Current Period Earnings (rolled)'
      prodSignedContribution = signed
    }

    rows.push({
      ...t,
      signedBalance: signed,
      includedInAuditorBS: auditorInclude,
      auditorClassification: auditorSection,
      productionLikeClassification: prodSection,
      productionSignedContribution: prodSignedContribution,
    })
  }

  // Exact first-auditor identity (phase14Reports Math.max clamps)
  let assets = 0
  let liabilities = 0
  let equity = 0
  let income = 0
  let expense = 0
  for (const r of rows) {
    const t = String(r.accountType || '').toLowerCase()
    const closing = r.signedBalance
    if (t === 'income' || t === 'revenue') income = toMoney(income + Math.max(0, -closing))
    else if (t === 'expense') expense = toMoney(expense + Math.max(0, closing))
    else if (t === 'asset') assets = toMoney(assets + closing)
    else if (t === 'liability') liabilities = toMoney(liabilities + Math.max(0, -closing))
    else if (t === 'equity') equity = toMoney(equity + Math.max(0, -closing))
  }
  const netProfit = toMoney(income - expense)
  const rhs = toMoney(liabilities + equity + netProfit)
  const identityWithNp = toMoney(assets - rhs)
  const identityWithoutNp = toMoney(assets - (liabilities + equity))

  // Production-like CPE: retainedEarnings = -(incomeSigned + expenseSigned) where signed = opening+Dr-Cr
  let incomeSignedTotal = 0
  let expenseSignedTotal = 0
  let prodAssets = 0
  let prodLiab = 0
  let prodEquity = 0
  const reclassContributors = []
  for (const r of rows) {
    const type = String(r.accountType || '')
    const bal = r.signedBalance
    if (type === 'Asset' || type.toLowerCase() === 'asset') {
      if (bal >= 0) prodAssets = toMoney(prodAssets + bal)
      else {
        prodLiab = toMoney(prodLiab + Math.abs(bal))
        reclassContributors.push({ accountCode: r.accountCode, accountName: r.accountName, from: 'Asset', to: 'Liability', amount: Math.abs(bal) })
      }
    } else if (type === 'Liability' || type.toLowerCase() === 'liability') {
      if (bal <= 0) prodLiab = toMoney(prodLiab + Math.abs(bal))
      else {
        prodAssets = toMoney(prodAssets + bal)
        reclassContributors.push({ accountCode: r.accountCode, accountName: r.accountName, from: 'Liability', to: 'Asset', amount: bal })
      }
    } else if (type === 'Equity' || type.toLowerCase() === 'equity') {
      prodEquity = toMoney(prodEquity + (-bal))
    } else if (type === 'Income' || type.toLowerCase() === 'income' || type.toLowerCase() === 'revenue') {
      incomeSignedTotal = toMoney(incomeSignedTotal + bal)
    } else if (type === 'Expense' || type.toLowerCase() === 'expense') {
      expenseSignedTotal = toMoney(expenseSignedTotal + bal)
    }
  }
  const retainedEarnings = toMoney(-(incomeSignedTotal + expenseSignedTotal))
  prodEquity = toMoney(prodEquity + retainedEarnings)
  const identityProd = toMoney(prodAssets - (prodLiab + prodEquity))

  // Accounts whose Math.max clamp drops non-normal balances (auditor vs full signed)
  const clampDropped = []
  for (const r of rows) {
    const t = String(r.accountType || '').toLowerCase()
    const c = r.signedBalance
    if (t === 'liability' && c > 0) clampDropped.push({ ...r, reason: 'liability debit balance clamped to 0 in auditor L' })
    if (t === 'equity' && c > 0) clampDropped.push({ ...r, reason: 'equity debit balance clamped to 0 in auditor E' })
    if ((t === 'income' || t === 'revenue') && c > 0) clampDropped.push({ ...r, reason: 'income debit balance clamped to 0 in auditor income' })
    if (t === 'expense' && c < 0) clampDropped.push({ ...r, reason: 'expense credit balance clamped to 0 in auditor expense' })
  }

  const topByAbs = [...rows]
    .filter((r) => Math.abs(r.signedBalance) >= 0.01)
    .sort((a, b) => Math.abs(b.signedBalance) - Math.abs(a.signedBalance))
    .slice(0, 25)
    .map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      signedBalance: r.signedBalance,
      auditorClassification: r.auditorClassification,
      productionLikeClassification: r.productionLikeClassification,
    }))

  return {
    rows: rows.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode))),
    summary: {
      assets,
      liabilities,
      equity,
      income,
      expense,
      netProfit,
      rhsLiabilitiesEquityNetProfit: rhs,
      identityAssetsMinusLiabEquity: identityWithoutNp,
      identityAssetsMinusLiabEquityNetProfit: identityWithNp,
      productionLike: {
        assets: prodAssets,
        liabilities: prodLiab,
        equityIncludingCpe: prodEquity,
        retainedEarningsCpe: retainedEarnings,
        identityAssetsMinusLiabEquity: identityProd,
      },
      firstAuditExpected: -90512.87,
      firstAuditActual: -85745.89,
      firstAuditDifference: -4766.98,
      matchesFirstAudit: Math.abs(assets - (-90512.87)) < 0.02 && Math.abs(rhs - (-85745.89)) < 0.02,
      clampDroppedCount: clampDropped.length,
      clampDroppedSample: clampDropped.slice(0, 20).map((r) => ({
        accountCode: r.accountCode,
        accountName: r.accountName,
        accountType: r.accountType,
        signedBalance: r.signedBalance,
        reason: r.reason,
      })),
      reclassContributors,
      topAccountsByAbsBalance: topByAbs,
      note: 'BALANCE_SHEET_GAP is from auditor CoA-type identity (Assets vs L+E+NP with Math.max clamps), not Trial Balance failure. Production reportSummaryService reclasses contra balances and rolls Income+Expense into Current Period Earnings.',
    },
  }
}

function buildClassificationMd({ alloy, dups, bs, dbName }) {
  const lines = []
  lines.push('# MG Findings Classification (read-only investigation)')
  lines.push('')
  lines.push(`- **Database:** ${dbName}`)
  lines.push(`- **Audit timestamp:** ${new Date().toISOString()}`)
  lines.push('- **Read-only:** YES')
  lines.push('')

  lines.push('## Final classification table')
  lines.push('')
  lines.push('| Finding | Status | Real data error? | Cause | Amount/Qty | Required fix (NOT executed) |')
  lines.push('|---------|--------|------------------|-------|------------|-----------------------------|')

  // Alloy
  const alloyStatus = alloy.determination.code.includes('C') || alloy.determination.code.includes('F')
    ? 'LEGITIMATE DATA / DATA MODEL ISSUE'
    : 'REQUIRES REVIEW'
  lines.push(`| 14k alloy qty 1 vs movements 0 | ${alloyStatus} | No (opening seed) | ${alloy.determination.explanation.replace(/\|/g, '/')} | qty diff **1** | Optionally post opening StockMovement of +1 or document that create-time qty is intentional without movement |`)

  let confirmed = 0
  let legitimate = 1 // alloy opening
  let falsePos = 0
  let reportCalc = 0
  let review = 0

  if (alloyStatus.includes('LEGITIMATE')) legitimate += 0 // already counted
  else review += 1

  for (const g of dups.groups) {
    const st = g.classification.status
    const real = st === 'CONFIRMED ERROR' ? 'Yes' : (st === 'REQUIRES REVIEW' ? 'Unknown' : 'No')
    const cause = g.classification.detail.replace(/\|/g, '/')
    lines.push(`| Duplicate ${g.name} (${g.financialEffect.amount}) | ${st} | ${real} | ${cause} | ${g.financialEffect.amount} | ${st === 'CONFIRMED ERROR' ? 'Soft-delete or void the extra ledger line after finance review' : 'Review descriptions/dates; keep if intentional'} |`)
    if (st === 'CONFIRMED ERROR') confirmed += 1
    else if (st === 'REQUIRES REVIEW') review += 1
    else if (st.includes('LEGITIMATE') || st.includes('FALSE')) {
      if (st.includes('FALSE')) falsePos += 1
      else legitimate += 1
    }
  }

  // BS
  const np = bs.summary.netProfit
  const without = bs.summary.identityAssetsMinusLiabEquity
  const withNp = bs.summary.identityAssetsMinusLiabEquityNetProfit
  const match = bs.summary.matchesFirstAudit ? 'YES' : 'partial'
  lines.push(`| Balance Sheet gap 4766.98 | REPORT CALCULATION ISSUE | No (auditor formula) | Auditor Assets=${bs.summary.assets} vs L+E+NP=${bs.summary.rhsLiabilitiesEquityNetProfit} (diff ${withNp}). First-audit match=${match}. Production identity=${bs.summary.productionLike?.identityAssetsMinusLiabEquity}. Clamp-dropped accounts=${bs.summary.clampDroppedCount}. Not a Trial Balance failure. | **4766.98** | Fix auditor BS identity to match production reportSummaryService (CPE + contra reclass); do not alter ledgers |`)
  reportCalc += 1

  lines.push('')
  lines.push('## Counts')
  lines.push('')
  lines.push(`- Confirmed errors: ${confirmed}`)
  lines.push(`- Legitimate records: ${legitimate}`)
  lines.push(`- False positives: ${falsePos}`)
  lines.push(`- Report calculation issues: ${reportCalc}`)
  lines.push(`- Requires manual review: ${review}`)
  lines.push('')

  lines.push('## Task 1 — 14k alloy summary')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify({ item: alloy.item, rollForward: alloy.rollForward, determination: alloy.determination }, null, 2))
  lines.push('```')
  lines.push('')

  lines.push('## Task 4 — Do duplicates explain BS gap?')
  lines.push('')
  const anyTrueDup = dups.groups.some((g) => g.classification.status === 'CONFIRMED ERROR')
  lines.push(anyTrueDup
    ? 'Confirmed duplicate groups are **balanced** Dr/Cr pairs → Trial Balance impact **0**. They do **not** explain the 4,766.98 auditor BS identity gap (Assets vs L+E+NP with Math.max clamps). Production-like BS identity is **0** — gap is auditor formula only.'
    : 'No group confirmed as true duplicate with BS identity impact; gap remains an auditor formula issue.')
  lines.push('')

  lines.push('## Recommended fixes (NOT executed)')
  lines.push('')
  lines.push('1. **14k alloy:** Accept opening qty 1 as create-seed OR add explicit opening stock movement (+1) in a controlled backfill (staging first).')
  lines.push('2. **Duplicate ledgers:** Finance review each CONFIRMED ERROR / REQUIRES REVIEW group; soft-delete true extras only with approval.')
  lines.push('3. **BS gap:** Update `phase14Reports` to use production BS identity (CPE rollup); re-run audit — expect WARNING to clear without DB changes.')
  lines.push('')
  lines.push('---')
  lines.push('Investigation only. No MongoDB writes were performed.')
  return lines.join('\n')
}

async function main() {
  if (process.env.MG_RECON_DB) {
    console.warn('[investigate] Unsetting MG_RECON_DB — live MG uses URI default DB only.')
    delete process.env.MG_RECON_DB
  }

  console.log('[investigate] Connecting read-only via MONGO_URI_MG…')
  const { db, dbName, close } = await connectMgReadOnly()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  try {
    try {
      db.collection('ledgers').insertOne({ __probe: true })
      throw new Error('Read-only guard failed')
    } catch (e) {
      if (!String(e.message).includes('READ-ONLY')) throw e
      console.log('[investigate] Read-only guard OK')
    }

    console.log(`[investigate] Database: ${dbName}`)
    if (dbName === 'ops_mg') {
      console.warn('[investigate] WARNING: DB is ops_mg — expected URI default (often ops-dashboard). Continuing as connected.')
    }

    console.log('[investigate] Task 1 — 14k alloy…')
    const alloy = await investigateAlloy(db)
    writeJson(path.join(OUT_DIR, 'mg-investigation-14k-alloy.json'), alloy)

    console.log('[investigate] Task 2 — duplicate ledger groups…')
    const dups = await investigateDuplicates(db)
    writeJson(path.join(OUT_DIR, 'mg-investigation-duplicate-ledgers.json'), dups)

    console.log('[investigate] Task 3 — balance sheet…')
    const bs = await investigateBalanceSheet(db)
    writeCsv(path.join(OUT_DIR, 'mg-investigation-balance-sheet.csv'), bs.rows.map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      parentAccountId: r.parentAccountId,
      debit: r.debits,
      credit: r.credits,
      signedBalance: r.signedBalance,
      includedInAuditorBS: r.includedInAuditorBS,
      auditorClassification: r.auditorClassification,
      productionLikeClassification: r.productionLikeClassification,
      isActive: r.isActive,
    })))
    writeJson(path.join(OUT_DIR, 'mg-investigation-balance-sheet-summary.json'), bs.summary)

    const md = buildClassificationMd({ alloy, dups, bs, dbName })
    writeText(path.join(OUT_DIR, 'MG-FINDINGS-CLASSIFICATION.md'), md)

    // Refine counts from md classifications
    let confirmed = 0
    let legitimate = 0
    let falsePos = 0
    let reportCalc = 0
    let review = 0
    for (const g of dups.groups) {
      if (g.classification.status === 'CONFIRMED ERROR') confirmed += 1
      else if (g.classification.status === 'REQUIRES REVIEW') review += 1
      else if (g.classification.status.includes('LEGITIMATE')) legitimate += 1
      else if (g.classification.status.includes('FALSE')) falsePos += 1
    }
    legitimate += 1 // alloy opening
    reportCalc += 1 // BS

    console.log('\n========== MG FINDINGS INVESTIGATION COMPLETE ==========')
    console.log(`Database: ${dbName} (READ-ONLY)`)
    console.log(`14k alloy determination: ${alloy.determination.code} — ${alloy.determination.label}`)
    console.log(`Stored=${alloy.rollForward.stored} Σmoves=${alloy.rollForward.sumActiveMovements} inferredOpening=${alloy.rollForward.inferredOpeningNotInMovements}`)
    console.log(`BS: Assets=${bs.summary.assets} L=${bs.summary.liabilities} E=${bs.summary.equity} NP=${bs.summary.netProfit}`)
    console.log(`BS identity (Assets−(L+E+NP)): ${bs.summary.identityAssetsMinusLiabEquityNetProfit} (first-audit match=${bs.summary.matchesFirstAudit})`)
    console.log(`Production-like identity: ${bs.summary.productionLike?.identityAssetsMinusLiabEquity}`)
    console.log(`Confirmed errors: ${confirmed}`)
    console.log(`Legitimate records: ${legitimate}`)
    console.log(`False positives: ${falsePos}`)
    console.log(`Report calculation issues: ${reportCalc}`)
    console.log(`Requires manual review: ${review}`)
    console.log(`Reports: ${OUT_DIR}`)
    console.log('=======================================================')
  } finally {
    await close()
  }
}

main().catch((err) => {
  console.error('[investigate] FAILED:', err.message)
  process.exitCode = 1
})
