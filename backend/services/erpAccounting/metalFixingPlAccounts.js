/**
 * Resolve metal Sales/Purchase Fixing P&L sub-accounts (91xxxx / 92xxxx),
 * matching direct-deal posting under Sales Revenue (4000) and COGS (5101).
 */

function metalDisplayName(metal) {
  const code = String(metal || 'XAU').trim().toUpperCase()
  if (code === 'XAG') return 'Silver'
  if (code === 'XPT') return 'Platinum'
  if (code === 'XPD') return 'Palladium'
  if (code === 'XAU') return 'Gold'
  return code || 'Metal'
}

function resolveMetalCodeFromText(...parts) {
  const raw = parts
    .map((part) => String(part || '').trim().toUpperCase())
    .filter(Boolean)
    .join(' ')
  if (!raw) return ''
  if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
  if (raw.includes('XAG') || raw.includes('SILVER') || raw.includes('SILV')) return 'XAG'
  if (raw.includes('XPT') || raw.includes('PLATINUM') || raw.includes('PLAT')) return 'XPT'
  if (raw.includes('XPD') || raw.includes('PALLADIUM') || raw.includes('PALL')) return 'XPD'
  return ''
}

function resolveVoucherMetalCode(tx = {}) {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  for (const line of lines) {
    const code = resolveMetalCodeFromText(line?.stockCode, line?.productType, line?.narration)
    if (code) return code
  }
  return ''
}

/**
 * @param {'sales'|'purchase'} kind - sales → Income under 4000 (91); purchase → Expense under 5101 (92)
 */
async function ensureMetalFixingPlAccount({
  user,
  kind,
  metalCode,
  currency,
  ensureAccountByCode,
  ensureChildAccountByName,
  session = null,
}) {
  const metal = String(metalCode || '').trim().toUpperCase()
  if (!metal || !ensureAccountByCode || !ensureChildAccountByName) return null

  const isSales = String(kind || '').toLowerCase() === 'sales'
  const parent = await ensureAccountByCode({
    user,
    code: isSales ? '4000' : '5101',
    name: isSales ? 'Sales Revenue' : 'Cost Of Goods Sold',
    accountType: isSales ? 'Income' : 'Expense',
    currency,
    session,
  })

  const accountName = `${metalDisplayName(metal)} ${isSales ? 'Sales' : 'Purchase'} Fixing`
  return ensureChildAccountByName({
    user,
    parentAccount: parent,
    accountType: isSales ? 'Income' : 'Expense',
    accountName,
    codePrefix: isSales ? '91' : '92',
    currency,
  })
}

module.exports = {
  metalDisplayName,
  resolveMetalCodeFromText,
  resolveVoucherMetalCode,
  ensureMetalFixingPlAccount,
}
