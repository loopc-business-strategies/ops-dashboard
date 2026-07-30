const DOC_PREFIX_BY_TYPE = {
  payment: 'Pay',
  receipt: 'Rec',
  purchase: 'Pur',
  sale: 'Sal',
  metal_receipt: 'MRec',
  metal_payment: 'MPay',
}

const VOUCHER_DOC_TYPES = Object.keys(DOC_PREFIX_BY_TYPE)

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getDocYear = (dateValue) => {
  const dt = new Date(dateValue || Date.now())
  const year = Number.isFinite(dt.getTime()) ? dt.getFullYear() : new Date().getFullYear()
  return String(year)
}

const parseAnyVoucherDocMeta = (docNo) => {
  const raw = String(docNo || '').trim()
  if (!raw) return null

  const numericOnly = raw.match(/^(\d+)$/)
  if (numericOnly) {
    const seq = Number(numericOnly[1])
    if (Number.isFinite(seq) && seq > 0) {
      return { prefix: '', year: 0, seq, sortKey: seq }
    }
  }

  const formatted = raw.match(/^([A-Za-z]+)\/(\d{4})\/(\d+)$/i)
  if (!formatted) return null

  const year = Number(formatted[2])
  const seq = Number(formatted[3])
  if (!Number.isFinite(year) || !Number.isFinite(seq) || seq <= 0) return null
  return {
    prefix: formatted[1],
    year,
    seq,
    sortKey: year * 100000 + seq,
  }
}

const parseVoucherDocMeta = (docNo, voucherType) => {
  const raw = String(docNo || '').trim()
  if (!raw) return null

  const numericOnly = raw.match(/^(\d+)$/)
  if (numericOnly) {
    const seq = Number(numericOnly[1])
    if (Number.isFinite(seq) && seq > 0) {
      return { prefix: '', year: 0, seq, sortKey: seq }
    }
  }

  const prefix = DOC_PREFIX_BY_TYPE[String(voucherType || '').toLowerCase()] || ''
  if (!prefix) return null

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const formatted = raw.match(new RegExp(`^${escapedPrefix}/(\\d{4})/(\\d+)$`, 'i'))
  if (!formatted) return null

  const year = Number(formatted[1])
  const seq = Number(formatted[2])
  if (!Number.isFinite(year) || !Number.isFinite(seq) || seq <= 0) return null
  return { prefix, year, seq, sortKey: year * 100000 + seq }
}

const buildVoucherDocNo = (voucherType, docDate, sequence) => {
  const prefix = DOC_PREFIX_BY_TYPE[String(voucherType || '').toLowerCase()] || 'Doc'
  const year = getDocYear(docDate)
  return `${prefix}/${year}/${String(sequence).padStart(4, '0')}`
}

const coerceVoucherDocNo = (voucherType, docNo, docDate) => {
  const type = String(voucherType || '').toLowerCase()
  const expectedPrefix = DOC_PREFIX_BY_TYPE[type]
  if (!expectedPrefix) return String(docNo || '').trim()

  const raw = String(docNo || '').trim()
  if (!raw) return buildVoucherDocNo(type, docDate, 1)

  const meta = parseAnyVoucherDocMeta(raw)
  if (!meta) return raw

  if (String(meta.prefix || '').toLowerCase() === expectedPrefix.toLowerCase()) {
    return raw
  }

  const year = meta.year === 0 ? getDocYear(docDate) : meta.year
  return buildVoucherDocNo(type, `${year}-01-01`, meta.seq)
}

const normalizeVoucherMetaDocNo = (voucherType, voucherMeta) => {
  if (!voucherMeta || typeof voucherMeta !== 'object') return voucherMeta
  const type = String(voucherType || '').toLowerCase()
  if (!VOUCHER_DOC_TYPES.includes(type)) return voucherMeta

  const docDate = voucherMeta.docDate || null
  const vocNo = coerceVoucherDocNo(type, voucherMeta.vocNo, docDate)
  if (vocNo === String(voucherMeta.vocNo || '').trim()) return voucherMeta
  return { ...voucherMeta, vocNo }
}

/**
 * Allocate the next voucher doc number for a type/year from active Transaction rows.
 * @param {import('mongoose').Model} TransactionModel
 * @param {string} voucherType
 * @param {string|Date|null} docDate
 */
async function allocateNextVoucherDocNo(TransactionModel, voucherType, docDate = null) {
  const type = String(voucherType || '').toLowerCase()
  const prefix = DOC_PREFIX_BY_TYPE[type]
  if (!prefix || !TransactionModel) {
    return buildVoucherDocNo(type || 'payment', docDate, 1)
  }
  const year = getDocYear(docDate)
  const prefixRe = new RegExp(`^${escapeRegex(prefix)}/${year}/(\\d+)$`, 'i')
  const rows = await TransactionModel.find({
    isDeleted: { $ne: true },
    type,
    'voucherMeta.vocNo': new RegExp(`^${escapeRegex(prefix)}/${year}/`, 'i'),
  })
    .select('voucherMeta.vocNo')
    .limit(8000)
    .lean()

  let maxSeq = 0
  for (const row of rows || []) {
    const match = String(row?.voucherMeta?.vocNo || '').match(prefixRe)
    if (!match) continue
    const seq = Number(match[1])
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
  }
  return buildVoucherDocNo(type, `${year}-01-01`, maxSeq + 1)
}

async function voucherDocNoExists(TransactionModel, vocNo) {
  const normalized = String(vocNo || '').trim()
  if (!normalized || !TransactionModel) return false
  const row = await TransactionModel.findOne({
    isDeleted: { $ne: true },
    'voucherMeta.vocNo': normalized,
  }).select('_id').lean()
  return Boolean(row)
}

module.exports = {
  DOC_PREFIX_BY_TYPE,
  VOUCHER_DOC_TYPES,
  getDocYear,
  parseAnyVoucherDocMeta,
  parseVoucherDocMeta,
  buildVoucherDocNo,
  coerceVoucherDocNo,
  normalizeVoucherMetaDocNo,
  allocateNextVoucherDocNo,
  voucherDocNoExists,
}
