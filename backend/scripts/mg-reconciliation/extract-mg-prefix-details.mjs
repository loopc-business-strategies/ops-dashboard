#!/usr/bin/env node
/**
 * MG ERP — FINAL PRE-FIX DETAIL EXTRACTION (READ-ONLY).
 * MONGO_URI_MG URI default DB only. Do NOT set MG_RECON_DB.
 * No soft-deletes, account updates, inventory changes, or BS code edits.
 *
 *   npm run audit:mg-prefix-details
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

const CONFIRMED = [
  {
    name: 'GROUP_1',
    originalId: '6a004dd9405de597f7843497',
    duplicateId: '6a004dd9405de597f7843499',
    expectedPlBase: 495.87,
    expectedVoc: 'Jv/2026/0005',
  },
  {
    name: 'GROUP_4',
    originalId: '6a0ed318223c93e758b7522b',
    duplicateId: '6a0ed318223c93e758b7522d',
    expectedPlBase: 28.94,
    expectedVoc: 'Jv/2026/0017',
  },
  {
    name: 'GROUP_5',
    originalId: '6a5db681eea5b5e2ba04db4f',
    duplicateId: '6a5db682eea5b5e2ba04db54',
    expectedPlBase: 0.06,
    expectedVoc: 'Jv/2026/0051',
  },
]

const REVIEW = [
  {
    name: 'GROUP_2',
    ids: ['6a06c9df1a1ff173e7cb87e6', '6a0ed571223c93e758b75230'],
    expectedVoc: 'BnkJV/2026/0005',
  },
  {
    name: 'GROUP_3',
    ids: ['6a06c9df1a1ff173e7cb87e7', '6a0ed571223c93e758b75231'],
    expectedVoc: 'BnkJV/2026/0005',
  },
]

const BS_CODES = ['2307', '2303', '2313', '2308', '2306', '2312']

function oid(id) {
  return new ObjectId(String(id))
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function writeText(file, text) {
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
}

function serializeDoc(doc) {
  if (!doc) return null
  return JSON.parse(JSON.stringify(doc, (_, v) => {
    if (v instanceof ObjectId) return String(v)
    if (v && typeof v === 'object' && v._bsontype === 'ObjectID') return String(v)
    return v
  }))
}

function extractVocNo(description = '') {
  const m = String(description).match(/\b((?:Jv|BnkJV|Pur|MPay|MRec|Sal)\/[\d/]+)/i)
  return m ? m[1] : ''
}

function fieldEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function buildAccountBalanceMap(db) {
  const accounts = await db.collection('chartofaccounts').find({}).toArray()
  const ledgers = await db.collection('ledgers').find({ isDeleted: { $ne: true } }).toArray()
  const byId = new Map()
  for (const a of accounts) {
    byId.set(String(a._id), {
      doc: a,
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
    if (byId.has(dr)) byId.get(dr).debits = toMoney(byId.get(dr).debits + amt)
    if (byId.has(cr)) byId.get(cr).credits = toMoney(byId.get(cr).credits + amt)
  }
  for (const v of byId.values()) {
    v.closing = toMoney(v.opening + v.debits - v.credits)
  }
  return { accounts, byId, byCode: new Map(accounts.map((a) => [String(a.accountCode || ''), a])) }
}

function resolveAccountView(acc, balEntry, parentAcc) {
  if (!acc) return null
  const bal = balEntry || { opening: 0, debits: 0, credits: 0, closing: 0 }
  return {
    accountId: String(acc._id),
    code: acc.accountCode || '',
    name: acc.accountName || '',
    type: acc.accountType || '',
    parentAccountId: acc.parentAccountId ? String(acc.parentAccountId) : null,
    parentCode: parentAcc?.accountCode || '',
    parentName: parentAcc?.accountName || '',
    openingBalance: bal.opening,
    debitTotal: bal.debits,
    creditTotal: bal.credits,
    closingBalance: bal.closing,
    isActive: acc.isActive !== false,
  }
}

async function resolveVoucher(db, ledgerDoc, expectedVoc) {
  const voc = expectedVoc || extractVocNo(ledgerDoc?.description)
  const out = {
    byReferenceId: null,
    byVocNo: [],
    primary: null,
    note: '',
  }
  if (ledgerDoc?.referenceId) {
    const tx = await db.collection('transactions').findOne({ _id: oid(ledgerDoc.referenceId) })
    if (tx) {
      out.byReferenceId = {
        transactionId: String(tx._id),
        voucherId: String(tx._id),
        voucherNumber: tx?.voucherMeta?.vocNo || '',
        type: tx.type,
        date: tx.date,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        source: 'transactions.by_referenceId',
        isDeleted: Boolean(tx.isDeleted),
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      }
      out.primary = out.byReferenceId
    }
  }
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
      voucherId: String(tx._id),
      voucherNumber: tx?.voucherMeta?.vocNo || '',
      type: tx.type,
      date: tx.date,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      source: 'transactions.by_vocNo',
      isDeleted: Boolean(tx.isDeleted),
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }))
    if (!out.primary) {
      out.primary = out.byVocNo.find((t) => !t.isDeleted) || out.byVocNo[0] || null
    }
  }
  if (!ledgerDoc?.referenceId && !out.primary) {
    out.note = 'Standalone journal line (null referenceId); no transaction document found'
  } else if (!ledgerDoc?.referenceId) {
    out.note = 'Standalone ledger line (null referenceId); voucher resolved by description vocNo only'
  }
  return out
}

function ledgerDetail(doc, role, debitView, creditView) {
  return {
    role,
    _id: String(doc._id),
    transactionId: doc.referenceId ? String(doc.referenceId) : null,
    voucherId: doc.referenceId ? String(doc.referenceId) : null,
    voucherNumber: extractVocNo(doc.description),
    transactionType: doc.referenceType || null,
    date: doc.date,
    status: doc.isDeleted ? 'deleted' : 'active',
    debitAccountId: doc.debitAccountId ? String(doc.debitAccountId) : null,
    creditAccountId: doc.creditAccountId ? String(doc.creditAccountId) : null,
    amount: doc.amount,
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
    baseAmount: baseAmount(doc.amount, doc.exchangeRate),
    description: doc.description,
    reference: doc.reference || doc.txRefNo || '',
    referenceType: doc.referenceType,
    autoTxNo: doc.autoTxNo || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isDeleted: Boolean(doc.isDeleted),
    debitAccount: debitView,
    creditAccount: creditView,
    fullDocument: serializeDoc(doc),
  }
}

function impactOfExtra(doc, debitView) {
  const base = baseAmount(doc.amount, doc.exchangeRate)
  const drType = String(debitView?.type || '').toLowerCase()
  const pl = drType === 'expense' ? base : 0
  return {
    debitNative: doc.amount,
    creditNative: doc.amount,
    currency: doc.currency,
    exchangeRate: doc.exchangeRate,
    debitBase: base,
    creditBase: base,
    netPlEffectBase: pl,
    netBalanceSheetIdentityEffect: 0,
  }
}

async function extractConfirmedGroup(db, meta, balMap) {
  const origDoc = await db.collection('ledgers').findOne({ _id: oid(meta.originalId) })
  const dupDoc = await db.collection('ledgers').findOne({ _id: oid(meta.duplicateId) })
  if (!origDoc || !dupDoc) {
    return { name: meta.name, error: 'Missing ledger', meta }
  }

  // Re-verify original vs duplicate by createdAt (do not trust hard-code blindly)
  const aTime = new Date(origDoc.createdAt).getTime()
  const bTime = new Date(dupDoc.createdAt).getTime()
  const createdAtConfirms = aTime <= bTime

  const debitAcc = balMap.byId.get(String(origDoc.debitAccountId || ''))
  const creditAcc = balMap.byId.get(String(origDoc.creditAccountId || ''))
  const parentDr = debitAcc?.doc?.parentAccountId
    ? balMap.byId.get(String(debitAcc.doc.parentAccountId))?.doc
    : null
  const parentCr = creditAcc?.doc?.parentAccountId
    ? balMap.byId.get(String(creditAcc.doc.parentAccountId))?.doc
    : null

  const debitView = resolveAccountView(debitAcc?.doc, debitAcc, parentDr)
  const creditView = resolveAccountView(creditAcc?.doc, creditAcc, parentCr)

  const original = ledgerDetail(origDoc, 'ORIGINAL', debitView, creditView)
  const duplicate = ledgerDetail(dupDoc, 'DUPLICATE', debitView, creditView)

  const sameAmount = fieldEqual(origDoc.amount, dupDoc.amount)
  const sameDebit = fieldEqual(String(origDoc.debitAccountId), String(dupDoc.debitAccountId))
  const sameCredit = fieldEqual(String(origDoc.creditAccountId), String(dupDoc.creditAccountId))
  const sameDate = fieldEqual(new Date(origDoc.date).toISOString(), new Date(dupDoc.date).toISOString())
  const sameDesc = fieldEqual(origDoc.description, dupDoc.description)
  const sameRate = fieldEqual(origDoc.exchangeRate, dupDoc.exchangeRate)
  const sameRefType = fieldEqual(origDoc.referenceType, dupDoc.referenceType)
  const sameCurrency = fieldEqual(origDoc.currency, dupDoc.currency)

  const voucherOrig = await resolveVoucher(db, origDoc, meta.expectedVoc)
  const voucherDup = await resolveVoucher(db, dupDoc, meta.expectedVoc)
  const effect = impactOfExtra(dupDoc, debitView)

  return {
    name: meta.name,
    expectedPlBase: meta.expectedPlBase,
    plMatchesExpected: Math.abs(effect.netPlEffectBase - meta.expectedPlBase) < 0.02,
    original,
    duplicate,
    sourceVoucherOriginal: voucherOrig,
    sourceVoucherDuplicate: voucherDup,
    evidence: {
      whyOriginal: createdAtConfirms
        ? `Ledger ${meta.originalId} has earlier or equal createdAt (${origDoc.createdAt}) vs duplicate (${dupDoc.createdAt})`
        : `WARNING: hard-coded original has later createdAt — verify manually`,
      whyDuplicate: createdAtConfirms
        ? `Ledger ${meta.duplicateId} created later (${dupDoc.createdAt}); identical business fields → repeated posting of same event`
        : `Hard-coded duplicate may not be later by createdAt`,
      creationTimestamp: { original: origDoc.createdAt, duplicate: dupDoc.createdAt, originalIsEarlier: createdAtConfirms },
      sameAmount,
      sameAccounts: sameDebit && sameCredit,
      sameDate,
      sameDescription: sameDesc,
      sameExchangeRate: sameRate,
      sameReferenceType: sameRefType,
      sameCurrency,
      sameBusinessEvent: sameAmount && sameDebit && sameCredit && sameDate && sameDesc,
      postingSequence: `${meta.originalId} then ${meta.duplicateId} (ObjectId order / createdAt)`,
      materialDiffsOnlyIdAndTimestamps: sameAmount && sameDebit && sameCredit && sameDate && sameDesc && sameRate && sameRefType && sameCurrency,
      sourceTransaction: {
        originalReferenceId: origDoc.referenceId ? String(origDoc.referenceId) : null,
        duplicateReferenceId: dupDoc.referenceId ? String(dupDoc.referenceId) : null,
        voucherNumber: meta.expectedVoc,
      },
    },
    financialEffectOfDuplicate: effect,
    recommendedDataCorrection: {
      action: 'NOT EXECUTED — soft-delete duplicate ledger after finance approval',
      keepLedgerId: meta.originalId,
      softDeleteLedgerId: meta.duplicateId,
      reverseVoucher: false,
      databaseObject: `ledgers._id=${meta.duplicateId}`,
    },
  }
}

async function extractBsAccounts(balMap) {
  const rows = []
  for (const code of BS_CODES) {
    const acc = balMap.byCode.get(code)
    if (!acc) {
      rows.push({ code, error: 'Account not found' })
      continue
    }
    const entry = balMap.byId.get(String(acc._id))
    const parent = acc.parentAccountId ? balMap.byId.get(String(acc.parentAccountId))?.doc : null
    const closing = entry.closing
    rows.push({
      code: acc.accountCode,
      name: acc.accountName,
      type: acc.accountType,
      parentCode: parent?.accountCode || '',
      parentName: parent?.accountName || '',
      parentAccountId: acc.parentAccountId ? String(acc.parentAccountId) : null,
      openingBalance: entry.opening,
      debitTotal: entry.debits,
      creditTotal: entry.credits,
      closingBalance: closing,
      currentReportClassification: closing > 0
        ? 'CLAMPED OUT OF LIABILITIES (phase14Reports Math.max(0,-closing)=0)'
        : 'LIABILITIES',
      expectedClassification: closing > 0
        ? 'ASSETS (reclass from Liability debit balance — buildBalanceSheetSummaryFromBalances)'
        : 'LIABILITIES',
      fullDocument: serializeDoc(acc),
    })
  }
  const sum = toMoney(rows.reduce((s, r) => s + Number(r.closingBalance || 0), 0))
  return {
    accounts: rows,
    combinedClosingBalance: sum,
    expectedSum: 4766.98,
    reconciles: Math.abs(sum - 4766.98) < 0.02,
  }
}

async function extractAlloy(db) {
  const item = await db.collection('inventoryitems').findOne({ _id: oid(ALLOY_ID) })
  const moves = await db.collection('stockmovements').find({ itemId: oid(ALLOY_ID) }).toArray()
  const active = moves.filter((m) => !m.isDeleted)
  const sumActive = toQty(active.reduce((s, m) => s + Number(m.change || 0), 0))
  const stored = toQty(item?.quantity || 0)
  return {
    classification: 'LEGITIMATE OPENING / CARRY-FORWARD SEED',
    itemId: ALLOY_ID,
    name: item?.name,
    quantity: stored,
    sumActiveMovements: sumActive,
    inferredOpening: toQty(stored - sumActive),
    firstMoveQuantityBefore: moves[0]?.quantityBefore ?? null,
    category: item?.category,
    recommendedAuditFormula: 'opening_inferred + Σ(non-deleted stock movements) = stored quantity',
    currentAuditFormula: 'Σ(non-deleted stock movements) = stored  (phase07Inventory — no opening allowance)',
    doNotModifyInventory: true,
  }
}

async function extractReviewGroups(db, balMap) {
  const groups = []
  for (const meta of REVIEW) {
    const docs = await db.collection('ledgers').find({ _id: { $in: meta.ids.map(oid) } }).toArray()
    const byId = new Map(docs.map((d) => [String(d._id), d]))
    const a = byId.get(meta.ids[0])
    const b = byId.get(meta.ids[1])
    const daysApart = Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) / 86400000
    const sameAuto = (a.autoTxNo || '') === (b.autoTxNo || '')
    groups.push({
      name: meta.name,
      classification: 'REQUIRE MANUAL REVIEW',
      reason: !sameAuto && daysApart >= 1
        ? `Same BnkJV key/amount/accounts but different autoTxNo (${a.autoTxNo} vs ${b.autoTxNo}) and createdAt ~${daysApart.toFixed(1)} days apart. Insufficient evidence to prove true duplicate without bank-statement match.`
        : 'Insufficient evidence to classify as true duplicate',
      recordA: {
        _id: String(a._id),
        amount: a.amount,
        currency: a.currency,
        autoTxNo: a.autoTxNo || '',
        description: a.description,
        date: a.date,
        createdAt: a.createdAt,
        referenceId: a.referenceId ? String(a.referenceId) : null,
        debitAccountId: String(a.debitAccountId || ''),
        creditAccountId: String(a.creditAccountId || ''),
        fullDocument: serializeDoc(a),
      },
      recordB: {
        _id: String(b._id),
        amount: b.amount,
        currency: b.currency,
        autoTxNo: b.autoTxNo || '',
        description: b.description,
        date: b.date,
        createdAt: b.createdAt,
        referenceId: b.referenceId ? String(b.referenceId) : null,
        debitAccountId: String(b.debitAccountId || ''),
        creditAccountId: String(b.creditAccountId || ''),
        fullDocument: serializeDoc(b),
      },
    })
  }
  return { groups }
}

function buildMarkdown({ duplicates, effects, bsAccounts, alloy, review, dbName }) {
  const L = []
  const p = (s = '') => L.push(s)

  p('# MG ERP — FINAL PRE-FIX DETAIL EXTRACTION')
  p('')
  p(`- **Database:** ${dbName}`)
  p(`- **Timestamp:** ${new Date().toISOString()}`)
  p('- **Mode:** READ-ONLY (no Mongo writes / soft-deletes / code changes)')
  p('')

  p('## A. Exact duplicate records')
  p('')
  for (const g of duplicates) {
    p(`### ${g.name} — DUPLICATE`)
    p('')
    p('```json')
    p(JSON.stringify({
      _id: g.duplicate._id,
      transactionId: g.duplicate.transactionId,
      voucherId: g.duplicate.voucherId,
      voucherNumber: g.duplicate.voucherNumber,
      transactionType: g.duplicate.transactionType,
      date: g.duplicate.date,
      status: g.duplicate.status,
      debitAccountId: g.duplicate.debitAccountId,
      creditAccountId: g.duplicate.creditAccountId,
      amount: g.duplicate.amount,
      currency: g.duplicate.currency,
      exchangeRate: g.duplicate.exchangeRate,
      description: g.duplicate.description,
      reference: g.duplicate.reference,
      referenceType: g.duplicate.referenceType,
      createdAt: g.duplicate.createdAt,
      updatedAt: g.duplicate.updatedAt,
      isDeleted: g.duplicate.isDeleted,
      debitAccount: g.duplicate.debitAccount,
      creditAccount: g.duplicate.creditAccount,
    }, null, 2))
    p('```')
    p('')
  }

  p('## B. Exact original records')
  p('')
  for (const g of duplicates) {
    p(`### ${g.name} — ORIGINAL`)
    p('')
    p(`- **Why ORIGINAL:** ${g.evidence.whyOriginal}`)
    p(`- **Why DUPLICATE:** ${g.evidence.whyDuplicate}`)
    p(`- Evidence: sameAmount=${g.evidence.sameAmount}, sameAccounts=${g.evidence.sameAccounts}, sameDate=${g.evidence.sameDate}, sameDescription=${g.evidence.sameDescription}, sameBusinessEvent=${g.evidence.sameBusinessEvent}, materialDiffsOnlyIdAndTimestamps=${g.evidence.materialDiffsOnlyIdAndTimestamps}`)
    p('')
    p('```json')
    p(JSON.stringify({
      _id: g.original._id,
      transactionId: g.original.transactionId,
      voucherId: g.original.voucherId,
      voucherNumber: g.original.voucherNumber,
      transactionType: g.original.transactionType,
      date: g.original.date,
      status: g.original.status,
      debitAccountId: g.original.debitAccountId,
      creditAccountId: g.original.creditAccountId,
      amount: g.original.amount,
      currency: g.original.currency,
      exchangeRate: g.original.exchangeRate,
      description: g.original.description,
      reference: g.original.reference,
      referenceType: g.original.referenceType,
      createdAt: g.original.createdAt,
      updatedAt: g.original.updatedAt,
      isDeleted: g.original.isDeleted,
      debitAccount: g.original.debitAccount,
      creditAccount: g.original.creditAccount,
    }, null, 2))
    p('```')
    p('')
  }

  p('## C. Exact affected vouchers')
  p('')
  for (const g of duplicates) {
    p(`### ${g.name}`)
    p('')
    p('```json')
    p(JSON.stringify({
      expectedVoc: g.sourceVoucherOriginal?.primary?.voucherNumber || g.original.voucherNumber,
      primary: g.sourceVoucherOriginal?.primary,
      note: g.sourceVoucherOriginal?.note,
      byVocNoCount: g.sourceVoucherOriginal?.byVocNo?.length || 0,
    }, null, 2))
    p('```')
    p('')
  }

  p('## Duplicate financial effect')
  p('')
  p('```json')
  p(JSON.stringify(effects, null, 2))
  p('```')
  p('')
  p(`**Total P&L distortion = ${effects.totalPlBase}** (expected 524.87, match=${effects.totalPlMatches524_87})`)
  p(`**Explains BS gap 4766.98?** ${effects.explainsBsGap4766_98}`)
  p('')

  p('## D. Exact six BS accounts')
  p('')
  p('| Code | Name | Type | Opening | Debit | Credit | Closing | Current | Expected |')
  p('|------|------|------|---------|-------|--------|---------|---------|----------|')
  for (const a of bsAccounts.accounts) {
    p(`| ${a.code} | ${a.name} | ${a.type} | ${a.openingBalance} | ${a.debitTotal} | ${a.creditTotal} | **${a.closingBalance}** | ${a.currentReportClassification} | ${a.expectedClassification} |`)
  }
  p('')
  p(`**Combined closing = ${bsAccounts.combinedClosingBalance}** (expected 4766.98, reconciles=${bsAccounts.reconciles})`)
  p('')

  p('## E. Exact report bug')
  p('')
  p('### CURRENT BEHAVIOR')
  p('')
  p('- File: `backend/scripts/mg-reconciliation/phases/14-17-reports-orphans.mjs`')
  p('- Function: `phase14Reports`')
  p('- Logic: `liabilities += Math.max(0, -closing)` for Liability accounts')
  p('- Effect: Liability accounts with **debit** closing balances (2307, 2303, 2313, 2308, 2306, 2312) contribute **0** to Liabilities and are **not** added to Assets')
  p('')
  p('### EXPECTED BEHAVIOR')
  p('')
  p('- File: `backend/services/erpAccounting/reportSummaryService.js`')
  p('- Function: `buildBalanceSheetSummaryFromBalances`')
  p('- Logic: if Liability and `bal > 0` → push to **Assets** (reclass); if Asset and `bal < 0` → push to **Liabilities**')
  p('- Income + Expense roll into Current Period Earnings equity line')
  p('- Production-like identity balances to **0**')
  p('')
  p('### EXACT BUG')
  p('')
  p('Auditor omits Liability debit balances from the RHS (`L+E+NP`) without moving them to Assets on the LHS → identity gap equals the sum of those six closings (**4,766.98**). This is a **report/auditor classification bug**, not bad ledger data for those accounts.')
  p('')

  p('## F. Recommended code-only report fix (NOT EXECUTED)')
  p('')
  p('1. In `phase14Reports` only: when classifying balances, reclass Liability debit closings into Assets and Asset credit closings into Liabilities (mirror `buildBalanceSheetSummaryFromBalances`), **or** import/share that helper.')
  p('2. Recompute identity as Assets ≈ Liabilities + Equity (incl. CPE).')
  p('3. **Do not** alter Mongo ledgers or CoA for this gap.')
  p('4. Re-run `npm run audit:mg-reconciliation` — expect `BALANCE_SHEET_GAP` to clear.')
  p('')

  p('## G. Recommended accounting-data correction for 3 duplicates (NOT EXECUTED)')
  p('')
  p('| Group | Keep (ORIGINAL) | Soft-delete (DUPLICATE) | Object |')
  p('|-------|-----------------|-------------------------|--------|')
  for (const g of duplicates) {
    p(`| ${g.name} | \`${g.recommendedDataCorrection.keepLedgerId}\` | \`${g.recommendedDataCorrection.softDeleteLedgerId}\` | \`ledgers\` |`)
  }
  p('')
  p('Requires finance approval. Soft-delete only the later ledger row. Do not reverse vouchers for null-`referenceId` standalone JV lines unless a single posted transaction is confirmed.')
  p('')

  p('## §6 — 14k alloy')
  p('')
  p('```json')
  p(JSON.stringify(alloy, null, 2))
  p('```')
  p('')

  p('## §7 — Groups 2 / 3')
  p('')
  for (const g of review.groups) {
    p(`### ${g.name}: **${g.classification}**`)
    p('')
    p(g.reason)
    p('')
    p(`- A: \`${g.recordA._id}\` autoTxNo=\`${g.recordA.autoTxNo}\` createdAt=${g.recordA.createdAt}`)
    p(`- B: \`${g.recordB._id}\` autoTxNo=\`${g.recordB.autoTxNo}\` createdAt=${g.recordB.createdAt}`)
    p('')
  }

  p('---')
  p('No fixes executed. No MongoDB writes.')
  return L.join('\n')
}

async function main() {
  if (process.env.MG_RECON_DB) {
    console.warn('[detail] Unsetting MG_RECON_DB')
    delete process.env.MG_RECON_DB
  }

  console.log('[detail] Connecting read-only via MONGO_URI_MG…')
  const { db, dbName, close } = await connectMgReadOnly()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  try {
    try {
      db.collection('ledgers').insertOne({ __probe: true })
      throw new Error('Read-only guard failed')
    } catch (e) {
      if (!String(e.message).includes('READ-ONLY')) throw e
      console.log('[detail] Read-only guard OK')
    }

    console.log(`[detail] Database: ${dbName}`)
    const balMap = await buildAccountBalanceMap(db)

    console.log('[detail] §§1–3 Confirmed duplicates…')
    const duplicates = []
    for (const meta of CONFIRMED) {
      duplicates.push(await extractConfirmedGroup(db, meta, balMap))
    }
    writeJson(path.join(OUT_DIR, 'mg-detail-duplicates.json'), { groups: duplicates })

    const effects = {
      group1: duplicates[0]?.financialEffectOfDuplicate,
      group4: duplicates[1]?.financialEffectOfDuplicate,
      group5: duplicates[2]?.financialEffectOfDuplicate,
      totalPlBase: toMoney(
        (duplicates[0]?.financialEffectOfDuplicate?.netPlEffectBase || 0)
        + (duplicates[1]?.financialEffectOfDuplicate?.netPlEffectBase || 0)
        + (duplicates[2]?.financialEffectOfDuplicate?.netPlEffectBase || 0),
      ),
      totalBsIdentityEffect: 0,
      totalPlMatches524_87: false,
      explainsBsGap4766_98: false,
    }
    effects.totalPlMatches524_87 = Math.abs(effects.totalPlBase - 524.87) < 0.02

    console.log('[detail] §4 Six BS accounts…')
    const bsAccounts = await extractBsAccounts(balMap)
    writeJson(path.join(OUT_DIR, 'mg-detail-bs-accounts.json'), bsAccounts)

    console.log('[detail] §6 Alloy…')
    const alloy = await extractAlloy(db)
    writeJson(path.join(OUT_DIR, 'mg-detail-alloy.json'), alloy)

    console.log('[detail] §7 Groups 2/3…')
    const review = await extractReviewGroups(db, balMap)
    writeJson(path.join(OUT_DIR, 'mg-detail-group2-3.json'), review)

    const md = buildMarkdown({ duplicates, effects, bsAccounts, alloy, review, dbName })
    writeText(path.join(OUT_DIR, 'MG-PREFIX-DETAIL-EXTRACTION.md'), md)

    console.log('\n========== MG PREFIX DETAIL EXTRACTION COMPLETE ==========')
    console.log(`Database: ${dbName} (READ-ONLY)`)
    console.log(`Total P&L distortion: ${effects.totalPlBase} (match 524.87=${effects.totalPlMatches524_87})`)
    console.log(`BS six-account sum: ${bsAccounts.combinedClosingBalance} (reconciles=${bsAccounts.reconciles})`)
    console.log('Groups 2/3: REQUIRE MANUAL REVIEW')
    console.log(`14k alloy: ${alloy.classification}`)
    console.log(`Reports: ${OUT_DIR}`)
    console.log('==========================================================')
  } finally {
    await close()
  }
}

main().catch((err) => {
  console.error('[detail] FAILED:', err.message)
  process.exitCode = 1
})
